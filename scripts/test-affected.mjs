import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { listChangedFiles, readOption, resolveBaseRef } from "./changed-source-files.mjs";

const ROOT_CONFIGURATION = new Set([
  ".npmrc",
  ".nvmrc",
  ".env.example",
  "docker-compose.yml",
  "eslint.config.js",
  "jscpd.json",
  "lefthook.yml",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "tsconfig.json",
  "turbo.json",
]);

const baseRef = resolveBaseRef(readOption("base"));
const changedFiles = listChangedFiles(baseRef);
const workspaceDirectories = changedWorkspaceDirectories(changedFiles);
const selectsAll = changedFiles.some(isRepositoryInfrastructure);

if (!selectsAll && workspaceDirectories.length === 0) {
  process.stdout.write(`No application workspaces affected (base: ${baseRef}).\n`);
  process.exit(0);
}

const filters = selectsAll ? [] : workspaceDirectories.map(workspaceFilter);
const selectedPackages = resolveSelectedPackages(filters);
const infrastructurePackages = selectedPackages.filter(hasInfrastructureTests);

if (infrastructurePackages.length > 0) preflight(selectedPackages);
if (selectsAll) runRootChecks();

runTurbo("test", filters);
runTurbo("test:integration", filters, ["--concurrency=1"]);
runTurbo("test:transport", filters, ["--concurrency=1"]);
process.stdout.write(
  `Affected tests passed for ${selectedPackages.length} workspace(s) (base: ${baseRef}).\n`,
);

function changedWorkspaceDirectories(files) {
  return [
    ...new Set(
      files.flatMap((file) => {
        const match = /^(apps|packages|tooling)\/[^/]+/u.exec(file);
        return match ? [match[0]] : [];
      }),
    ),
  ].toSorted();
}

function isRepositoryInfrastructure(file) {
  return (
    ROOT_CONFIGURATION.has(file) || file.startsWith("scripts/") || file.startsWith(".github/")
  );
}

function workspaceFilter(directory) {
  const manifest = JSON.parse(readFileSync(path.join(directory, "package.json"), "utf8"));
  return `--filter=...${manifest.name}`;
}

function resolveSelectedPackages(filters) {
  const result = spawnSync(
    "pnpm",
    ["exec", "turbo", "run", "test", "test:integration", "test:transport", ...filters, "--dry=json"],
    { encoding: "utf8" },
  );
  if (result.status !== 0) fail("Turbo could not resolve affected workspaces.", result.stderr);
  const payload = JSON.parse(result.stdout);
  return payload.packages;
}

function hasInfrastructureTests(packageName) {
  const directory = packageDirectory(packageName);
  if (!directory) return false;
  const manifest = JSON.parse(readFileSync(path.join(directory, "package.json"), "utf8"));
  return Boolean(manifest.scripts?.["test:integration"] || manifest.scripts?.["test:transport"]);
}

function packageDirectory(packageName) {
  for (const scope of ["apps", "packages", "tooling"]) {
    if (!existsSync(scope)) continue;
    for (const entry of readdirSync(scope)) {
      const directory = path.join(scope, entry);
      const manifestPath = path.join(directory, "package.json");
      if (!existsSync(manifestPath)) continue;
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      if (manifest.name === packageName) return directory;
    }
  }
}

function preflight(packages) {
  if (!existsSync(".env")) {
    fail(
      "Infrastructure tests require .env. Run pnpm bootstrap:worktree, then pnpm prisma:deploy.",
    );
  }
  const drift = spawnSync("pnpm", ["exec", "dotenv", "-e", ".env", "--", "pnpm", "prisma:drift"], {
    encoding: "utf8",
  });
  if (drift.status !== 0) {
    fail(
      "Postgres is unavailable or schema drifted. Run pnpm bootstrap:worktree and pnpm prisma:deploy.",
      drift.stderr,
    );
  }
  if (packages.includes("@lazuli/integrations")) checkMailpit();
}

function checkMailpit() {
  const result = spawnSync("curl", ["--fail", "--silent", "http://localhost:8025/api/v1/info"], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    fail("Mailpit is unavailable. Run pnpm bootstrap:worktree before affected integration tests.");
  }
}

function runRootChecks() {
  for (const task of ["test:scripts", "test:component-lines", "test:styles"]) {
    const result = spawnSync("pnpm", [task], { stdio: "inherit" });
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}

function runTurbo(task, filters, extra = []) {
  const result = spawnSync("pnpm", ["exec", "turbo", "run", task, ...filters, ...extra], {
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function fail(message, detail = "") {
  process.stderr.write(`${message}\n${detail}`);
  process.exit(1);
}
