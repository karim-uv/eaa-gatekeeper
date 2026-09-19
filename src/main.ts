import * as core from "@actions/core";
import * as github from "@actions/github";
import { lint } from "./lint.js";
import { changedLineMap, lintable, partition } from "./diff.js";
import { inlineComment, reviewBody } from "./comment.js";

async function run(): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is not set");

  const pr = github.context.payload.pull_request;
  if (!pr) throw new Error("not a pull_request event");

  const { owner, repo } = github.context.repo;
  const pullNumber = pr.number;
  const headSha = (pr.head as { sha: string }).sha;

  const octokit = github.getOctokit(token);
  const { data: files } = await octokit.rest.pulls.listFiles({
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100,
  });

  const targets = lintable(files).map((f) => f.filename);
  core.info(`PR #${pullNumber} at ${headSha}`);
  core.info(`linting ${targets.length} changed file(s): ${targets.join(", ") || "none"}`);

  const violations = await lint(targets);
  const { inline, summary } = partition(violations, changedLineMap(files));

  core.info(`${violations.length} violation(s): ${inline.length} in diff, ${summary.length} outside`);
  for (const v of inline) core.info(`  in-diff  ${v.file}:${v.line}  ${v.ruleId}`);
  for (const v of summary) core.info(`  outside  ${v.file}:${v.line}  ${v.ruleId}`);

  if (violations.length === 0) {
    core.info("no violations, nothing to post");
    return;
  }

  const review = {
    owner,
    repo,
    pull_number: pullNumber,
    commit_id: headSha,
    event: "COMMENT" as const,
    body: reviewBody(inline, summary),
  };

  try {
    await octokit.rest.pulls.createReview({
      ...review,
      comments: inline.map((v) => ({
        path: v.file,
        line: v.line,
        side: "RIGHT" as const,
        body: inlineComment(v),
      })),
    });
    core.info(`posted review with ${inline.length} inline comment(s)`);
  } catch (err: unknown) {
    // The reviews endpoint is all-or-nothing: a single unanchorable comment
    // drops the entire batch. Post the summary alone rather than lose it.
    core.warning(
      `inline review rejected (${err instanceof Error ? err.message : String(err)}); posting summary only`,
    );
    await octokit.rest.pulls.createReview(review);
  }
}

run().catch((err: unknown) => {
  core.setFailed(err instanceof Error ? err.message : String(err));
});
