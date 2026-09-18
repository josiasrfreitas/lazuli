import { collectOrphanedWorkspaces } from "./lib/workspace-gc.mjs";

const arguments_ = process.argv.slice(2);

if (arguments_.some((argument) => argument !== "--prune")) {
  process.stderr.write("Usage: pnpm workspace:gc [--prune]\n");
  process.exitCode = 2;
} else {
  try {
    const result = await collectOrphanedWorkspaces(process.cwd(), {
      prune: arguments_.includes("--prune"),
      output: (message) => process.stdout.write(`${message}\n`),
    });
    if (result.incomplete) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`workspace:gc failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
