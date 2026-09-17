import { createInterface } from "node:readline/promises";

import { assertOwnedFullWorkspace } from "./lib/workspace-resource-guard.mjs";
import { resetWorkspace } from "./lib/workspace-maintenance.mjs";
import { acceptsWorkspaceReset } from "./lib/workspace-reset-confirmation.mjs";

const root = process.cwd();
const output = (message) => process.stdout.write(`${message}\n`);
const errorOutput = (message) => process.stderr.write(`${message}\n`);

function usage() {
  errorOutput("Usage: pnpm workspace:reset [--yes]");
}

async function confirmed() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("interactive confirmation is required; use --yes for non-interactive use");
  }
  const workspace = await assertOwnedFullWorkspace(root);
  output("This will permanently recreate only these worktree resources:");
  output(`  Database: ${workspace.resources.database}`);
  output(`  Bucket:   ${workspace.resources.bucket}`);
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await prompt.question("Type 'reset' to continue: ");
    return acceptsWorkspaceReset(answer);
  } finally {
    prompt.close();
  }
}

try {
  const arguments_ = process.argv.slice(2);
  if (arguments_.some((argument) => argument !== "--yes") || arguments_.length > 1) {
    usage();
    process.exitCode = 2;
  } else if (!arguments_.includes("--yes") && !(await confirmed())) {
    output("Workspace reset cancelled; no resources were changed.");
  } else {
    if (arguments_.includes("--yes")) {
      const workspace = await assertOwnedFullWorkspace(root);
      output(`Resetting database ${workspace.resources.database}.`);
      output(`Resetting bucket ${workspace.resources.bucket}.`);
    }
    await resetWorkspace({ root, output });
  }
} catch (error) {
  errorOutput(`workspace:reset failed: ${error.message}`);
  errorOutput("Retry with pnpm workspace:reset --yes or recover with pnpm workspace:setup full.");
  process.exitCode = 1;
}
