import { readFile } from "node:fs/promises";
import path from "node:path";

export async function readSuppressions(cwd) {
  try {
    return JSON.parse(await readFile(path.join(cwd, "eslint-suppressions.json"), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
}

/** Preserve ESLint's count limits and failure on unused suppression allowances. */
export function applySuppressions(results, { suppressions, cwd }) {
  for (const result of results) {
    const relative = path.relative(cwd, result.filePath).split(path.sep).join("/");
    for (const [ruleId, allowance] of Object.entries(suppressions[relative] ?? {})) {
      const count = result.messages.filter(
        (message) => message.ruleId === ruleId && message.severity === 2,
      ).length;
      if (!Number.isSafeInteger(allowance.count) || allowance.count < 0) {
        throw new Error(`Invalid suppression count for ${relative}: ${ruleId}`);
      }
      if (count <= allowance.count) {
        result.suppressedMessages.push(
          ...result.messages.filter((message) => message.ruleId === ruleId),
        );
        result.messages = result.messages.filter((message) => message.ruleId !== ruleId);
      }
      if (count < allowance.count) {
        result.messages.push({
          ruleId: "lazuli/unused-suppression",
          severity: 2,
          line: 1,
          column: 1,
          message: `${ruleId}: ${allowance.count - count} unused suppression(s). Update eslint-suppressions.json.`,
        });
      }
    }
  }
  return results;
}
