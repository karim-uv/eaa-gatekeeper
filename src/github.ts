import type { getOctokit } from "@actions/github";
import { MARKER } from "./comment.js";

export type Octokit = ReturnType<typeof getOctokit>;

export interface RepoRef {
  owner: string;
  repo: string;
}

export const STATUS_CONTEXT = "EAA Gatekeeper";

export async function setStatus(
  octokit: Octokit,
  { owner, repo }: RepoRef,
  sha: string,
  state: "success" | "failure",
  description: string,
): Promise<void> {
  await octokit.rest.repos.createCommitStatus({
    owner,
    repo,
    sha,
    state,
    context: STATUS_CONTEXT,
    // The API rejects anything longer than 140 characters.
    description: description.slice(0, 140),
    target_url: runUrl(),
  });
}

/**
 * Removes this action's own comments from earlier runs. Both conditions
 * matter: the marker alone would match a human quoting it, and the author
 * alone would match unrelated bot comments.
 */
export async function deleteStaleComments(
  octokit: Octokit,
  { owner, repo }: RepoRef,
  pullNumber: number,
): Promise<number> {
  const { data } = await octokit.rest.pulls.listReviewComments({
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100,
  });

  const stale = data.filter(
    (comment) =>
      comment.user?.login === "github-actions[bot]" && comment.body.includes(MARKER),
  );

  for (const comment of stale) {
    await octokit.rest.pulls.deleteReviewComment({
      owner,
      repo,
      comment_id: comment.id,
    });
  }

  return stale.length;
}

function runUrl(): string | undefined {
  const server = process.env.GITHUB_SERVER_URL;
  const repository = process.env.GITHUB_REPOSITORY;
  const runId = process.env.GITHUB_RUN_ID;
  if (!server || !repository || !runId) return undefined;
  return `${server}/${repository}/actions/runs/${runId}`;
}
