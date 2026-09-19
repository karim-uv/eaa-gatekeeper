import type { Violation } from "./lint.js";

export interface ChangedFile {
  filename: string;
  status: string;
  patch?: string | null;
}

const LINTABLE = /\.(jsx|tsx)$/;

export function lintable(files: ChangedFile[]): ChangedFile[] {
  return files.filter((f) => f.status !== "removed" && LINTABLE.test(f.filename));
}

/**
 * New-side line numbers present in a patch: added lines and context lines.
 * GitHub accepts an inline comment on any of these; anything else 422s.
 */
export function changedLines(patch: string): Set<number> {
  const lines = new Set<number>();
  let cursor = 0;

  for (const row of patch.split("\n")) {
    const header = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(row);
    if (header) {
      cursor = Number(header[1]);
      continue;
    }
    if (row.startsWith("-") || row.startsWith("\\")) continue;
    if (row.startsWith("+") || row.startsWith(" ")) {
      lines.add(cursor);
      cursor += 1;
    }
  }

  return lines;
}

export function changedLineMap(files: ChangedFile[]): Map<string, Set<number>> {
  const map = new Map<string, Set<number>>();
  for (const file of lintable(files)) {
    if (!file.patch) continue;
    map.set(file.filename, changedLines(file.patch));
  }
  return map;
}

export function partition(
  violations: Violation[],
  map: Map<string, Set<number>>,
): { inline: Violation[]; summary: Violation[] } {
  const inline: Violation[] = [];
  const summary: Violation[] = [];

  for (const violation of violations) {
    if (map.get(violation.file)?.has(violation.line)) inline.push(violation);
    else summary.push(violation);
  }

  return { inline, summary };
}
