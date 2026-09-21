import { spawn } from "node:child_process";

import { readWorkspaceMetadata } from "./lib/workspace-metadata.mjs";
import { registerStorybookRoute, unregisterStorybookRoute } from "./lib/workspace-proxy.mjs";

const root = process.cwd();

function errorOutput(message) {
  process.stderr.write(`${message}\n`);
}

async function main() {
  const workspace = await readWorkspaceMetadata(root);
  if (workspace === null) {
    throw new Error("workspace metadata is absent; run pnpm workspace:setup light first");
  }
  await registerStorybookRoute(root, workspace);
  try {
    const child = spawn("pnpm", ["-F", "@lazuli/storybook", "dev"], {
      cwd: root,
      env: process.env,
      stdio: "inherit",
    });
    let stopping = false;
    const stop = async (signal) => {
      if (stopping) return;
      stopping = true;
      child.kill(signal);
      await unregisterStorybookRoute(root, workspace);
    };
    process.once("SIGINT", () => void stop("SIGINT"));
    process.once("SIGTERM", () => void stop("SIGTERM"));
    const code = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("close", (exitCode) => resolve(exitCode ?? 1));
    });
    process.exitCode = code;
  } finally {
    await unregisterStorybookRoute(root, workspace);
  }
}

try {
  await main();
} catch (error) {
  errorOutput(`storybook failed: ${error.message}`);
  process.exitCode = 1;
}
