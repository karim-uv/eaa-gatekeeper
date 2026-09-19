import { readFileSync } from "node:fs";
import { ruleMap } from "./rulemap.js";
import type { Violation } from "./lint.js";

/** Identifies our own comments so a re-run can clear them without touching others. */
export const MARKER = "<!-- eaa-gatekeeper";

const EAA_NOTE =
  "Required under the **European Accessibility Act** (Directive (EU) 2019/882). " +
  "EN 301 549 is the harmonised standard presumed to confer conformity.";

export function inlineComment(violation: Violation): string {
  const rule = ruleMap[violation.ruleId];
  const code = sourceLine(violation.file, violation.line);

  return [
    `<!-- eaa-gatekeeper:${violation.ruleId} -->`,
    `### Accessibility violation — \`${violation.ruleId}\``,
    "",
    violation.message,
    "",
    "```jsx",
    code,
    "```",
    "",
    "**Why this is required**",
    "",
    `- **WCAG 2.1** — SC ${rule.wcag.sc} ${rule.wcag.name} (Level ${rule.wcag.level})`,
    `- **EN 301 549** — clause ${rule.en301549}`,
    `- ${EAA_NOTE}`,
    "",
    "**Suggested fix**",
    "",
    rule.fix,
    "",
    "**Prompt for an AI coding agent**",
    "",
    "```text",
    agentPrompt(violation, code),
    "```",
  ].join("\n");
}

export function reviewBody(inline: Violation[], summary: Violation[]): string {
  const total = inline.length + summary.length;

  const rows = [...inline, ...summary].map((v) => {
    const rule = ruleMap[v.ruleId];
    return `| \`${v.file}\` | ${v.line} | \`${v.ruleId}\` | ${rule.wcag.sc} ${rule.wcag.name} | ${rule.en301549} |`;
  });

  const parts = [
    "<!-- eaa-gatekeeper:summary -->",
    `## EAA Gatekeeper — ${total} accessibility violation${total === 1 ? "" : "s"}`,
    "",
    "The React files changed in this pull request were scanned against WCAG 2.1 Level A as mapped to EN 301 549, the harmonised standard presumed to confer conformity with the European Accessibility Act (Directive (EU) 2019/882).",
    "",
    "| File | Line | Rule | WCAG 2.1 | EN 301 549 |",
    "| --- | --- | --- | --- | --- |",
    ...rows,
  ];

  if (summary.length > 0) {
    parts.push(
      "",
      `### ${summary.length} outside this diff`,
      "",
      "These are in files this pull request changes, but on lines it does not touch, so GitHub cannot anchor an inline comment to them.",
      "",
      ...summary.map((v) => `- \`${v.file}:${v.line}\` — \`${v.ruleId}\``),
    );
  }

  return parts.join("\n");
}

function agentPrompt(violation: Violation, code: string): string {
  const rule = ruleMap[violation.ruleId];

  return [
    `Fix an accessibility violation in ${violation.file} at line ${violation.line}.`,
    "",
    `Rule: ${violation.ruleId}`,
    `Standard: WCAG 2.1 SC ${rule.wcag.sc} ${rule.wcag.name} (Level ${rule.wcag.level}), EN 301 549 clause ${rule.en301549}`,
    "Legal basis: European Accessibility Act, Directive (EU) 2019/882.",
    "",
    "Current code:",
    code,
    "",
    `Required change: ${rule.prompt}`,
    "",
    "Keep the change minimal and do not alter unrelated markup or behaviour.",
  ].join("\n");
}

function sourceLine(file: string, line: number): string {
  try {
    return readFileSync(file, "utf8").split("\n")[line - 1]?.trim() ?? "";
  } catch {
    return "";
  }
}
