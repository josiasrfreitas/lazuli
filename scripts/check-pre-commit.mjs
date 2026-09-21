import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { listStagedFiles } from "./changed-source-files.mjs";
import { getGitIndependentProcessEnvironment } from "./config.mjs";
import { classifyChanges, workspaceFilters } from "./lib/check-scope.mjs";

const files = listStagedFiles();
const scope = classifyChanges(files);
const filters = workspaceFilters(scope);
process.stdout.write(
  `Pre-commit mode: staged\nClassification: ${scope.categories.join(", ") || "empty"}\n`,
);
const lintable = files.filter((file) => /\.(?:c|m)?(?:j|t)sx?$/u.test(file) && existsSync(file));
if (lintable.length > 0)
  run({ command: "pnpm", args: ["exec", "eslint", ...lintable], phase: "staged ESLint" });
run({ command: "pnpm", args: ["test:quality:changed", "--staged"], phase: "test quality" });
if (scope.scriptTests) run({ command: "pnpm", args: ["test:scripts"], phase: "script unit tests" });
if (scope.all || filters.length > 0)
  run({
    command: "pnpm",
    args: ["exec", "turbo", "run", "test", ...filters],
    phase: "affected unit tests",
  });
process.stdout.write("Pre-commit checks passed.\n");

function run({ command, args, phase }) {
  process.stdout.write(`Phase: ${phase}\n`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: getGitIndependentProcessEnvironment(),
  });
  if (result.status !== 0) throw new Error(`${phase} failed with exit code ${result.status ?? 1}.`);
}
