import { spawnSync } from "node:child_process";

import chalk from "chalk";
import Table from "cli-table3";

import { readWorkspaceMetadata } from "./lib/workspace-metadata.mjs";

const root = process.cwd();
const STATUS_ARGUMENT_COUNT = 2;

function output(message) {
  process.stdout.write(`${message}\n`);
}

function errorOutput(message) {
  process.stderr.write(`${message}\n`);
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
  const label = (value) => chalk.cyan(value);
  const table = new Table({
    head: [chalk.bold.cyan("Workspace"), chalk.bold.cyan("Value")],
    style: { head: [], border: [] },
    wordWrap: true,
  });
  table.push(
    [label("Profile"), chalk.bold(workspace.profile)],
    [label("Identity"), workspace.identity],
    [label("Web URL"), workspace.urls.web],
    [label("Storybook URL"), workspace.urls.storybook],
    [label("Web port"), workspace.ports.web],
    [label("Storybook port"), workspace.ports.storybook],
    [
      label("Database"),
      `${workspace.resources.database}\n${chalk.yellow("Not provisioned by the light profile")}`,
    ],
    [
      label("Bucket"),
      `${workspace.resources.bucket}\n${chalk.yellow("Not provisioned by the light profile")}`,
    ],
    [label("Shared stack"), observedStackHealth()],
    [label("Dependencies"), "pnpm for installation; Docker Compose is optional."],
  );
  output(chalk.bold("Workspace status"));
  output(chalk.dim("Local configuration and observed shared-stack health"));
  output("");
  output(table.toString());
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
