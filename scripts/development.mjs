import { spawn } from "node:child_process";

import { readWorkspaceMetadata } from "./lib/workspace-metadata.mjs";
import { registerWorkspaceRoute, unregisterWorkspaceRoute } from "./lib/workspace-proxy.mjs";

const root = process.cwd();
const service = process.argv[2];

function run(command, arguments_) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, arguments_, { cwd: root, env: process.env, stdio: "inherit" });
    child.once("error", reject);
    child.once("close", (code) => resolve(code ?? 1));
  });
}

function validateEnvironment(workspace) {
  const expected = {
    APP_URL: workspace.urls.web,
    BETTER_AUTH_URL: workspace.urls.web,
    LAZULI_WEB_PORT: String(workspace.ports.web),
  };
  for (const [name, value] of Object.entries(expected)) {
    if (process.env[name] !== value) {
      throw new Error(`${name} must be ${value}; run pnpm workspace:setup full`);
    }
  }
}

async function preflight() {
  const workspace = await readWorkspaceMetadata(root);
  if (workspace === null)
    throw new Error("workspace metadata is absent; run pnpm workspace:setup full");
  if (workspace.profile !== "full") {
    throw new Error("Web and Worker require a full workspace; run pnpm workspace:setup full");
  }
  validateEnvironment(workspace);
  const status = await run("pnpm", ["workspace:setup", "full"]);
  if (status !== 0)
    throw new Error("full workspace reconciliation failed; run pnpm workspace:setup full");
  return workspace;
}

async function main() {
  if (service !== "web" && service !== "worker") {
    throw new Error("Usage: node scripts/development.mjs <web|worker>");
  }
  const workspace = await preflight();
  await registerWorkspaceRoute(root, workspace, service);
  try {
    const child = spawn("pnpm", ["-F", `@lazuli/${service}`, "dev"], {
      cwd: root,
      detached: true,
      env: process.env,
      stdio: "inherit",
    });
    let stopping = false;
    const stop = async (signal) => {
      if (stopping) return;
      stopping = true;
      if (child.pid !== undefined) {
        try {
          process.kill(-child.pid, signal);
        } catch {
          child.kill(signal);
        }
      }
      await unregisterWorkspaceRoute(root, workspace, service);
    };
    process.once("SIGINT", () => void stop("SIGINT"));
    process.once("SIGTERM", () => void stop("SIGTERM"));
    process.exitCode = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("close", (code) => resolve(code ?? 1));
    });
  } finally {
    await unregisterWorkspaceRoute(root, workspace, service);
  }
}

try {
  await main();
} catch (error) {
  process.stderr.write(`development failed: ${error.message}\n`);
  process.exitCode = 1;
}
