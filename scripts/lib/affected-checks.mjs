import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { getGitIndependentProcessEnvironment } from "../config.mjs";
import {
  listCommittedFiles,
  listStagedFiles,
  readOption,
  resolveBaseRef,
} from "../changed-source-files.mjs";
import { classifyChanges, packageDirectory, workspaceFilters } from "./check-scope.mjs";
import {
  createEphemeralDatabase,
  dropEphemeralDatabase,
  preflightInfrastructure,
  reapProvenOrphans,
} from "./ephemeral-test-database.mjs";

export async function runAffectedChecks({ staged = false, unitOnly = false }) {
  const baseRef = staged ? undefined : resolveBaseRef(readOption("base"));
  const scope = classifyChanges(staged ? listStagedFiles() : listCommittedFiles(baseRef));
  const filters = workspaceFilters(scope);
  const packages = scope.all || filters.length > 0 ? resolvePackages(filters) : [];
  const tiers = unitOnly
    ? {
        integration: false,
        transport: false,
        database: false,
        mailpit: false,
        workspaceIntegration: false,
      }
    : determineTiers(scope, packages);
  process.stdout.write(
    `${staged ? "Mode: staged" : `Base: ${baseRef}`}\nClassification: ${scope.categories.join(", ") || "empty"}\nInfrastructure: ${formatCapabilities(tiers)}\n`,
  );
  let database;
  let cleanupError;
  const clean = () => {
    if (!database) return;
    try {
      dropEphemeralDatabase(database);
      process.stdout.write(`Cleanup: removed ${database.name}\n`);
      database = undefined;
    } catch (error) {
      cleanupError = error;
      process.stderr.write(`${error.message}\n`);
    }
  };
  const onSignal = (signal) => {
    clean();
    process.kill(process.pid, signal);
  };
  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);
  try {
    if (tiers.database) {
      if (tiers.workspaceIntegration) assertFullWorkspaceCapability();
      preflightInfrastructure({ mailpit: tiers.mailpit, fakeGcs: tiers.workspaceIntegration });
      const orphanReport = reapProvenOrphans();
      if (orphanReport.preserved.length > 0)
        process.stdout.write(
          `Preserved ambiguous temporary databases: ${orphanReport.preserved.join(", ")}\n`,
        );
      database = createEphemeralDatabase({ workspaceIdentity: workspaceIdentity() });
      process.stdout.write(`Temporary database: ${database.name}\n`);
      run({
        command: "pnpm",
        args: ["prisma:deploy"],
        phase: "database migrations",
        databaseUrl: database.url,
      });
      run({
        command: "pnpm",
        args: ["prisma:drift"],
        phase: "database drift",
        databaseUrl: database.url,
      });
    }
    if (scope.scriptTests)
      run({
        command: "pnpm",
        args: ["test:scripts"],
        phase: "script unit tests",
        databaseUrl: database?.url,
      });
    if (packages.length > 0)
      runTurbo({
        tasks: ["test"],
        filters,
        phase: "affected unit tests",
        databaseUrl: database?.url,
      });
    if (tiers.integration)
      runTurbo({
        tasks: ["test:integration"],
        filters,
        phase: "affected integration tests",
        databaseUrl: database.url,
        extra: ["--concurrency=1"],
      });
    if (tiers.transport)
      runTurbo({
        tasks: ["test:transport"],
        filters,
        phase: "affected transport tests",
        databaseUrl: database.url,
        extra: ["--concurrency=1"],
      });
    if (tiers.workspaceIntegration)
      run({
        command: "pnpm",
        args: ["test:workspace:integration"],
        phase: "workspace integration",
      });
  } finally {
    process.removeListener("SIGINT", onSignal);
    process.removeListener("SIGTERM", onSignal);
    clean();
  }
  if (cleanupError) process.exitCode = 1;
  else process.stdout.write("Affected tests passed.\n");
}

function resolvePackages(filters) {
  const result = spawnSync(
    "pnpm",
    [
      "exec",
      "turbo",
      "run",
      "lint",
      "typecheck",
      "build",
      "test",
      "test:integration",
      "test:transport",
      ...filters,
      "--dry=json",
    ],
    { encoding: "utf8", env: getGitIndependentProcessEnvironment() },
  );
  if (result.status !== 0)
    throw new Error(`Turbo could not resolve affected workspaces.\n${result.stderr}`);
  return JSON.parse(result.stdout).packages;
}

function determineTiers(scope, packages) {
  let integration = scope.forceInfrastructureTiers;
  let transport = scope.forceInfrastructureTiers;
  let mailpit = false;
  for (const packageName of packages) {
    const directory = packageDirectory(packageName);
    if (!directory) continue;
    const scripts =
      JSON.parse(readFileSync(path.join(directory, "package.json"), "utf8")).scripts ?? {};
    integration ||= Boolean(scripts["test:integration"]);
    transport ||= Boolean(scripts["test:transport"]);
    mailpit ||= packageName === "@lazuli/integrations";
  }
  mailpit ||= scope.workspaceIntegration;
  return {
    integration,
    transport,
    database: integration || transport || scope.workspaceIntegration,
    mailpit,
    workspaceIntegration: scope.workspaceIntegration,
  };
}

function formatCapabilities(tiers) {
  const values = [];
  if (tiers.database) values.push("Postgres");
  if (tiers.mailpit) values.push("Mailpit");
  if (tiers.workspaceIntegration) values.push("fake-GCS", "workspace-full");
  return values.join(", ") || "none";
}

function workspaceIdentity() {
  try {
    const metadata = JSON.parse(readFileSync(".lazuli/workspace.json", "utf8"));
    if (typeof metadata.identity === "string") return metadata.identity;
  } catch {
    // A workspace without metadata uses its directory name as a stable local identity.
  }
  return path.basename(process.cwd());
}

function assertFullWorkspaceCapability() {
  let workspace;
  try {
    workspace = JSON.parse(readFileSync(".lazuli/workspace.json", "utf8"));
  } catch {
    throw new Error(
      "Full workspace integration is unavailable because workspace metadata is missing or invalid. No service was started and the profile was not promoted automatically. Run: pnpm workspace:setup full",
    );
  }
  if (workspace.profile !== "full") {
    throw new Error(
      "Full workspace integration is unavailable in a light worktree. No service was started and the profile was not promoted automatically. Run: pnpm workspace:setup full",
    );
  }
}

function runTurbo({ tasks, filters, phase, databaseUrl, extra = [] }) {
  run({
    command: "pnpm",
    args: ["exec", "turbo", "run", ...tasks, ...filters, ...extra],
    phase,
    databaseUrl,
  });
}
function run({ command, args, phase, databaseUrl }) {
  process.stdout.write(`Phase: ${phase}\n`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: getGitIndependentProcessEnvironment(databaseUrl ? { DATABASE_URL: databaseUrl } : {}),
  });
  if (result.status !== 0) throw new Error(`${phase} failed with exit code ${result.status ?? 1}.`);
}
