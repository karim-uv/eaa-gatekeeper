import { relative, sep } from "node:path";
import { ESLint } from "eslint";
import jsxA11y from "eslint-plugin-jsx-a11y";
import tsParser from "@typescript-eslint/parser";
import { ruleIds } from "./rulemap.js";

export interface Violation {
  file: string;
  line: number;
  ruleId: string;
  message: string;
}

export async function lint(files: string[]): Promise<Violation[]> {
  if (files.length === 0) return [];

  const eslint = new ESLint({
    // Without this ESLint 9 discovers a config file in the checked-out repo
    // and silently changes which rules run.
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ["**/*.jsx", "**/*.tsx"],
        languageOptions: {
          parser: tsParser,
          parserOptions: { ecmaFeatures: { jsx: true } },
        },
        plugins: { "jsx-a11y": jsxA11y },
        rules: Object.fromEntries(ruleIds.map((id) => [id, "error"])),
      },
    ],
  });

  const results = await eslint.lintFiles(files);
  const violations: Violation[] = [];

  for (const result of results) {
    const file = toRepoPath(result.filePath);
    for (const message of result.messages) {
      // A parse error yields zero rule violations, which would otherwise turn
      // the gate green on a broken file. Fail loudly instead.
      if (message.fatal) {
        throw new Error(`parse error in ${file}:${message.line}: ${message.message}`);
      }
      if (!message.ruleId) continue;
      violations.push({
        file,
        line: message.line,
        ruleId: message.ruleId,
        message: message.message,
      });
    }
  }

  return violations;
}

/** ESLint reports absolute paths; the GitHub API needs repo-relative POSIX. */
function toRepoPath(absolute: string): string {
  return relative(process.cwd(), absolute).split(sep).join("/");
}
