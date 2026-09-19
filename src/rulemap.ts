import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export interface RuleEntry {
  wcag: { sc: string; name: string; level: string };
  en301549: string;
  fix: string;
  prompt: string;
}

const mapPath = fileURLToPath(new URL("../data/rule-map.json", import.meta.url));

/**
 * The single source of truth. Which rules ESLint runs is derived from these
 * keys, so a violation can never be reported without a legal citation.
 */
export const ruleMap: Record<string, RuleEntry> = JSON.parse(
  readFileSync(mapPath, "utf8"),
) as Record<string, RuleEntry>;

export const ruleIds = Object.keys(ruleMap);

/**
 * A missing field would render a comment with a hole in its legal citation,
 * and a typo'd key would silently disable a rule. Fail at startup instead.
 */
export function assertRuleMapComplete(): void {
  if (ruleIds.length === 0) throw new Error("rule-map.json is empty");

  for (const [id, entry] of Object.entries(ruleMap)) {
    const missing: string[] = [];
    if (!entry.wcag?.sc) missing.push("wcag.sc");
    if (!entry.wcag?.name) missing.push("wcag.name");
    if (!entry.wcag?.level) missing.push("wcag.level");
    if (!entry.en301549) missing.push("en301549");
    if (!entry.fix) missing.push("fix");
    if (!entry.prompt) missing.push("prompt");
    if (missing.length > 0) {
      throw new Error(`rule-map entry "${id}" is missing: ${missing.join(", ")}`);
    }
  }
}
