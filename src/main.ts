import * as core from "@actions/core";
import * as github from "@actions/github";

async function run(): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is not set");

  const pr = github.context.payload.pull_request;
  if (!pr) throw new Error("not a pull_request event");

  const { owner, repo } = github.context.repo;
  const pullNumber = pr.number;
  const headSha = (pr.head as { sha: string }).sha;

  // context.sha is the ephemeral merge commit on pull_request events; the
  // commit status in step 5 must go to head.sha instead. Logged to prove it.
  core.info(`PR #${pullNumber}`);
  core.info(`head.sha    = ${headSha}`);
  core.info(`context.sha = ${github.context.sha}`);

  const octokit = github.getOctokit(token);

  const { data: files } = await octokit.rest.pulls.listFiles({
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100,
  });

  const fixture = files.map((f) => ({
    filename: f.filename,
    status: f.status,
    patch: f.patch,
  }));
  core.info("----- BEGIN fixture.json -----");
  core.info(JSON.stringify(fixture, null, 2));
  core.info("----- END fixture.json -----");

  await octokit.rest.pulls.createReviewComment({
    owner,
    repo,
    pull_number: pullNumber,
    commit_id: headSha,
    path: "demo/BadForm.jsx",
    line: 6,
    side: "RIGHT",
    body: "hello from EAA Gatekeeper",
  });

  core.info("posted inline comment on demo/BadForm.jsx:6");
}

run().catch((err: unknown) => {
  core.setFailed(err instanceof Error ? err.message : String(err));
});
