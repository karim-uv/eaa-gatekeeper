import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export interface RuleEntry {
  wcag: { sc: string; name: string; level: string };
  en301549: string;
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
