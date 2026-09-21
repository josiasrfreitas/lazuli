import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { link, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as wait } from "node:timers/promises";
import { getProcessEnvironment, workspaceComposeHealthTimeoutMs } from "../config.mjs";
import {
  databaseInitializationCompleted,
  provisionDatabaseInitializationStore,
} from "./local-workspace-initialization.mjs";
import { ensureLocalBucket, localBucketExists } from "./workspace-gcs.mjs";

export const DATABASE_INITIALIZATION_PATH = ".lazuli/database-initialization.json";
export const WORKSPACE_FULL_INITIALIZATION_KEY = "workspace-full-v1";
const LOCK_RETRY_MS = 50,
  LOCK_ID_LENGTH = 20,
  HEALTH_RETRY_MS = 250;
const POSTGRES_CONTAINER = "lazuli-postgres";
const BUCKET_OWNERSHIP_OBJECT = ".lazuli-workspace-ownership.json";

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function ownershipPathHash(workspace) {
  return createHash("sha256").update(workspace.initialTechnicalPath).digest("hex");
}

export function bucketOwnership(workspace) {
  return {
    ownershipToken: workspace.ownershipToken,
    workspaceIdentity: workspace.identity,
    technicalPath: workspace.initialTechnicalPath,
  };
}

export function bucketOwnershipLabels(workspace) {
  return {
    lazuli_owner_token: workspace.ownershipToken,
    lazuli_workspace: workspace.identity,
    lazuli_technical_path: ownershipPathHash(workspace),
  };
}

export function bucketOwnershipObjectName() {
  return BUCKET_OWNERSHIP_OBJECT;
}

function processStartedAt(pid) {
  const result = spawnSync("ps", ["-p", String(pid), "-o", "lstart="], { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : null;
}
function lockPath(root) {
  const identity = createHash("sha256")
    .update(path.resolve(root))
    .digest("hex")
    .slice(0, LOCK_ID_LENGTH);
  return path.join(tmpdir(), `lazuli-workspace-full-${identity}.lock`);
}

async function atomicJson(target, value) {
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, target);
}

async function ownerIsProvablyDead(ownerPath) {
  let owner;
  try {
    owner = JSON.parse(await readFile(ownerPath, "utf8"));
  } catch {
    return false;
  }
  if (!Number.isInteger(owner.pid) || typeof owner.startedAt !== "string") return false;
  const actualStart = processStartedAt(owner.pid);
  return actualStart === null || actualStart !== owner.startedAt;
}

export async function withFullSetupLock(root, callback) {
  const target = lockPath(root);
  while (true) {
    const candidate = `${target}.${process.pid}.${Date.now()}`;
    try {
      await writeFile(
        candidate,
        `${JSON.stringify({
          pid: process.pid,
          startedAt: processStartedAt(process.pid),
          acquiredAt: new Date().toISOString(),
        })}\n`,
        { flag: "wx" },
      );
      await link(candidate, target);
      await rm(candidate, { force: true });
      break;
    } catch (error) {
      await rm(candidate, { force: true });
      if (error.code !== "EEXIST") throw error;
      if (await ownerIsProvablyDead(target)) {
        await rm(target, { force: true });
        continue;
      }
      await wait(LOCK_RETRY_MS);
    }
  }
  try {
    return await callback();
  } finally {
    await rm(target, { force: true });
  }
}

export async function dependenciesNeedInstall(root) {
  try {
    const [workspaceLock, installedLock] = await Promise.all([
      readFile(path.join(root, "pnpm-lock.yaml")),
      readFile(path.join(root, "node_modules/.pnpm/lock.yaml")),
    ]);
    return !workspaceLock.equals(installedLock);
  } catch (error) {
    if (error.code === "ENOENT") return true;
    throw error;
  }
}

export function runWorkspaceCommand({
  command,
  arguments_,
  root,
  capture = false,
  capability = command,
  environment,
}) {
  try {
    return execFileSync(command, arguments_, {
      cwd: root,
      encoding: capture ? "utf8" : undefined,
      env: environment === undefined ? undefined : getProcessEnvironment(environment),
      stdio: capture ? undefined : "inherit",
    });
  } catch (error) {
    const detail = error.stderr?.toString().trim();
    throw new Error(`${capability} failed${detail ? `: ${detail}` : ""}`, {
      cause: error,
    });
  }
}

function composeRows(root) {
  const source = runWorkspaceCommand({
    command: "docker",
    arguments_: ["compose", "ps", "--format", "json"],
    root,
    capture: true,
    capability: "Docker Compose health observation",
  }).trim();
  if (source === "") return [];
  return source.split("\n").flatMap((line) => {
    const value = JSON.parse(line);
    return Array.isArray(value) ? value : [value];
  });
}

export async function reconcileCompose(root, output) {
  output("Reconciling shared Docker Compose services...");
  runWorkspaceCommand({
    command: "docker",
    arguments_: ["compose", "up", "-d"],
    root,
    capability: "Docker Compose reconciliation",
  });
  const services = runWorkspaceCommand({
    command: "docker",
    arguments_: ["compose", "config", "--services"],
    root,
    capture: true,
    capability: "Docker Compose service discovery",
  })
    .trim()
    .split(/\s+/u)
    .filter(Boolean);
  const deadline = Date.now() + workspaceComposeHealthTimeoutMs;
  let problems;
  do {
    const rows = composeRows(root);
    problems = services.flatMap((service) => {
      const row = rows.find((candidate) => (candidate.Service ?? candidate.Name) === service);
      if (row === undefined) return [`${service} is absent`];
      const state = String(row.State ?? "").toLowerCase();
      const health = String(row.Health ?? "").toLowerCase();
      if (state !== "running") return [`${service} is ${state || "not running"}`];
      if (health !== "" && health !== "healthy") return [`${service} is ${health}`];
      return [];
    });
    if (problems.length === 0) return services;
    if (Date.now() < deadline) await wait(HEALTH_RETRY_MS);
  } while (Date.now() < deadline);
  const affected = problems.map((problem) => problem.split(" ")[0]).join(", ");
  throw new Error(
    `shared services are not ready (${problems.join(", ")}). Diagnose with: docker compose ps; docker compose logs ${affected}. Retry with: pnpm workspace:setup full`,
  );
}

function databaseExists(root, database) {
  const result = runWorkspaceCommand({
    command: "docker",
    arguments_: [
      "exec",
      POSTGRES_CONTAINER,
      "psql",
      "-U",
      "lazuli",
      "-d",
      "postgres",
      "-tAc",
      `SELECT 1 FROM pg_database WHERE datname = '${database}'`,
    ],
    root,
    capture: true,
    capability: "Postgres database inspection",
  });
  return result.trim() === "1";
}

async function readJournal(root) {
  try {
    return JSON.parse(await readFile(path.join(root, DATABASE_INITIALIZATION_PATH), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw new Error(`invalid database initialization journal: ${error.message}`, { cause: error });
  }
}

export async function ensureDatabase({ root, workspace, output }) {
  const journalPath = path.join(root, DATABASE_INITIALIZATION_PATH);
  let journal = await readJournal(root);
  let exists = databaseExists(root, workspace.resources.database);
  if (!exists) {
    journal = { database: workspace.resources.database, status: "pending" };
    await atomicJson(journalPath, journal);
    output(`Creating Postgres database ${workspace.resources.database}...`);
    runWorkspaceCommand({
      command: "docker",
      arguments_: [
        "exec",
        POSTGRES_CONTAINER,
        "psql",
        "-U",
        "lazuli",
        "-d",
        "postgres",
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        `CREATE DATABASE ${workspace.resources.database}`,
      ],
      root,
      capability: "Postgres database creation",
    });
    exists = true;
    runWorkspaceCommand({
      command: "docker",
      arguments_: psqlArguments(workspace.resources.database, [
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        `CREATE SCHEMA IF NOT EXISTS lazuli_local; CREATE TABLE IF NOT EXISTS lazuli_local.workspace_ownership (singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton), ownership_token text NOT NULL, workspace_identity text NOT NULL, technical_path text NOT NULL); INSERT INTO lazuli_local.workspace_ownership (singleton, ownership_token, workspace_identity, technical_path) VALUES (true, ${sqlLiteral(workspace.ownershipToken)}, ${sqlLiteral(workspace.identity)}, ${sqlLiteral(workspace.initialTechnicalPath)}) ON CONFLICT (singleton) DO NOTHING`,
      ]),
      root,
      capability: "Postgres workspace ownership marking",
    });
  }
  output("Applying database migrations...");
  runWorkspaceCommand({
    command: "pnpm",
    arguments_: ["prisma:deploy"],
    root,
    capability: "database migrations",
  });
  provisionDatabaseInitializationStore({
    database: workspace.resources.database,
    root,
    run: runWorkspaceCommand,
  });
  if (journal?.status === "pending") {
    await completeDatabaseInitialization({ root, workspace, journalPath, output });
  }
  return exists;
}

function psqlArguments(database, command) {
  return ["exec", POSTGRES_CONTAINER, "psql", "-U", "lazuli", "-d", database, ...command];
}

async function completeDatabaseInitialization({ root, workspace, journalPath, output }) {
  if (
    databaseInitializationCompleted({
      database: workspace.resources.database,
      initializationKey: WORKSPACE_FULL_INITIALIZATION_KEY,
      root,
      run: runWorkspaceCommand,
    })
  ) {
    output("Finalizing completed database initialization...");
  } else {
    output("Loading database fixtures...");
    runWorkspaceCommand({
      command: "pnpm",
      arguments_: ["prisma:seed"],
      root,
      capability: "database initialization",
      environment: { LAZULI_WORKSPACE_INITIALIZATION_KEY: WORKSPACE_FULL_INITIALIZATION_KEY },
    });
  }
  await atomicJson(journalPath, {
    database: workspace.resources.database,
    status: "complete",
    completedAt: new Date().toISOString(),
  });
}

export function bucketExists(root, bucket) {
  return localBucketExists({ root, bucket, run: runWorkspaceCommand });
}

export async function ensureBucket({ root, workspace, output, overwrite = false }) {
  await ensureLocalBucket({
    root,
    workspace,
    output,
    overwrite,
    run: runWorkspaceCommand,
    ownership: {
      labels: bucketOwnershipLabels(workspace),
      objectName: BUCKET_OWNERSHIP_OBJECT,
      contents: JSON.stringify(bucketOwnership(workspace)),
    },
  });
}

export function observeDatabase(root, database) {
  try {
    return databaseExists(root, database) ? "exists" : "absent";
  } catch (error) {
    return `not observed (${error.message})`;
  }
}

export function observeBucket(root, bucket) {
  try {
    return bucketExists(root, bucket) ? "exists" : "absent";
  } catch (error) {
    return `not observed (${error.message})`;
  }
}

export async function databaseInitializationStatus(root) {
  const journal = await readJournal(root);
  if (journal === null) return "not pending";
  return journal.status === "pending" ? "incomplete (retry setup full)" : "complete";
}
