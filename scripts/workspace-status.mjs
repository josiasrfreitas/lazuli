import { spawnSync } from "node:child_process";

import { readWorkspaceMetadata } from "./lib/workspace-metadata.mjs";

const root = process.cwd();
const STATUS_ARGUMENT_COUNT = 2;

function output(message) {
  process.stdout.write(`${message}\n`);
}

function errorOutput(message) {
  process.stderr.write(`${message}\n`);
}

function section(title) {
  output(`\n${title}`);
}

function observedStackHealth() {
  const result = spawnSync("docker", ["compose", "ps", "--format", "json"], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.error?.code === "ENOENT") return "not observed (Docker is unavailable)";
  if (result.status !== 0) return "not observed (Docker is not accessible)";
  const rows = result.stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const value = JSON.parse(line);
        return Array.isArray(value) ? value : [value];
      } catch {
        return [];
      }
    });
  if (rows.length === 0) return "not observed (no shared services are running)";
  return rows
    .map(
      (row) =>
        `${row.Service ?? row.Name ?? "service"}: ${row.Health ?? row.State ?? "unknown state"}`,
    )
    .join(", ");
}

function printWorkspaceStatus(workspace) {
  output("Workspace status");
  output("================");
  output(`Profile: ${workspace.profile}`);
  output(`Identity: ${workspace.identity}`);

  section("URLs");
  output(`  Web:       ${workspace.urls.web}`);
  output(`  Storybook: ${workspace.urls.storybook}`);

  section("Ports");
  output(`  Web:       ${workspace.ports.web}`);
  output(`  Storybook: ${workspace.ports.storybook}`);

  section("Resources");
  output(`  Database: ${workspace.resources.database} (not provisioned by the light profile)`);
  output(`  Bucket:   ${workspace.resources.bucket} (not provisioned by the light profile)`);

  section("Shared stack");
  output(`  Observed health: ${observedStackHealth()}`);
  output("  Dependencies: pnpm for installation; Docker Compose is optional.");
}

async function main() {
  if (process.argv.length !== STATUS_ARGUMENT_COUNT) {
    errorOutput("Usage: pnpm workspace:status");
    process.exitCode = 2;
    return;
  }
  const workspace = await readWorkspaceMetadata(root);
  if (workspace === null) {
    throw new Error("workspace metadata is absent; run pnpm workspace:setup light first");
  }
  printWorkspaceStatus(workspace);
}

try {
  await main();
} catch (error) {
  errorOutput(`workspace:status failed: ${error.message}`);
  process.exitCode = 1;
}
