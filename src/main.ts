import * as core from "@actions/core";
import * as github from "@actions/github";
import { lint, type Violation } from "./lint.js";
import { changedLineMap, lintable, partition } from "./diff.js";
import { inlineComment, reviewBody } from "./comment.js";
import { deleteStaleComments, setStatus, type Octokit, type RepoRef } from "./github.js";
import { assertRuleMapComplete, ruleIds } from "./rulemap.js";

async function run(): Promise<void> {
  assertRuleMapComplete();
  core.info(`${ruleIds.length} mapped rules enforced`);

  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is not set");

  const pr = github.context.payload.pull_request;
  if (!pr) throw new Error("not a pull_request event");

  const repoRef = github.context.repo;
  const pullNumber = pr.number;
  // context.sha is the ephemeral merge commit on pull_request events; a status
  // posted there is accepted but never appears on the pull request.
  const headSha = (pr.head as { sha: string }).sha;
  const octokit = github.getOctokit(token);

  try {
    const removed = await deleteStaleComments(octokit, repoRef, pullNumber);
    if (removed > 0) core.info(`cleared ${removed} comment(s) from an earlier run`);

    const { data: files } = await octokit.rest.pulls.listFiles({
      ...repoRef,
      pull_number: pullNumber,
      per_page: 100,
    });

    const targets = lintable(files).map((f) => f.filename);
    core.info(`linting ${targets.length} changed file(s): ${targets.join(", ") || "none"}`);

    const violations = await lint(targets);
    const { inline, summary } = partition(violations, changedLineMap(files));
    for (const v of inline) core.info(`  in-diff  ${v.file}:${v.line}  ${v.ruleId}`);
    for (const v of summary) core.info(`  outside  ${v.file}:${v.line}  ${v.ruleId}`);

    if (violations.length === 0) {
      await setStatus(octokit, repoRef, headSha, "success", "No accessibility violations found");
      core.info("no violations; gate is green");
      return;
    }

    await postReview(octokit, repoRef, pullNumber, headSha, inline, summary);

    const plural = violations.length === 1 ? "" : "s";
    await setStatus(
      octokit,
      repoRef,
      headSha,
      "failure",
      `${violations.length} accessibility violation${plural} (WCAG 2.1 / EN 301 549)`,
    );
    core.setFailed(
      `${violations.length} accessibility violation${plural} must be fixed before merge.`,
    );
  } catch (err: unknown) {
    // Leave an explicit red status rather than a silent pending one.
    await setStatus(
      octokit,
      repoRef,
      headSha,
      "failure",
      `EAA Gatekeeper errored: ${message(err)}`,
    ).catch(() => undefined);
    throw err;
  }
}

async function postReview(
  octokit: Octokit,
  repoRef: RepoRef,
  pullNumber: number,
  headSha: string,
  inline: Violation[],
  summary: Violation[],
): Promise<void> {
  const review = {
    ...repoRef,
    pull_number: pullNumber,
    commit_id: headSha,
    // COMMENT, not REQUEST_CHANGES: a changes-requested review blocks the pull
    // request independently of the commit status and is not dismissed by later
    // pushes, so the gate could never turn green again.
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
    core.warning(`inline review rejected (${message(err)}); posting summary only`);
    await octokit.rest.pulls.createReview(review);
  }
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

run().catch((err: unknown) => {
  core.setFailed(message(err));
});
