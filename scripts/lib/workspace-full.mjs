import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { link, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as wait } from "node:timers/promises";

import { workspaceComposeHealthTimeoutMs } from "../config.mjs";

export const DATABASE_INITIALIZATION_PATH = ".lazuli/database-initialization.json";
const LOCK_RETRY_MS = 50;
const LOCK_ID_LENGTH = 20;
const HEALTH_RETRY_MS = 250;

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

function run({ command, arguments_, root, capture = false, capability = command }) {
  try {
    return execFileSync(command, arguments_, {
      cwd: root,
      encoding: capture ? "utf8" : undefined,
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
  const source = run({
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
  run({
    command: "docker",
    arguments_: ["compose", "up", "-d"],
    root,
    capability: "Docker Compose reconciliation",
  });
  const services = run({
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
  const result = run({
    command: "docker",
    arguments_: [
      "exec",
      "lazuli-postgres",
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
    run({
      command: "docker",
      arguments_: [
        "exec",
        "lazuli-postgres",
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
  }
  output("Applying database migrations...");
  run({ command: "pnpm", arguments_: ["prisma:deploy"], root, capability: "database migrations" });
  if (journal?.status === "pending") {
    output("Loading database fixtures...");
    run({
      command: "pnpm",
      arguments_: ["prisma:seed"],
      root,
      capability: "database initialization",
    });
    await atomicJson(journalPath, {
      database: workspace.resources.database,
      status: "complete",
      completedAt: new Date().toISOString(),
    });
  }
  return exists;
}

function curlStatus(root, url) {
  return run({
    command: "curl",
    arguments_: ["-sS", "-o", "/dev/null", "-w", "%{http_code}", url],
    root,
    capture: true,
    capability: "fake-GCS inspection",
  }).trim();
}

export function bucketExists(root, bucket) {
  return (
    curlStatus(root, `http://localhost:4443/storage/v1/b/${bucket}?project=lazuli-local`) === "200"
  );
}

async function seedFiles(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const key = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory())
      files.push(...(await seedFiles(path.join(directory, entry.name), key)));
    else if (entry.isFile() && entry.name !== ".gitkeep")
      files.push({ path: path.join(directory, entry.name), key });
  }
  return files;
}

export async function ensureBucket({ root, workspace, output }) {
  const bucket = workspace.resources.bucket;
  if (!bucketExists(root, bucket)) {
    output(`Creating fake-GCS bucket ${bucket}...`);
    run({
      command: "curl",
      arguments_: [
        "-fsS",
        "-X",
        "POST",
        "-H",
        "Content-Type: application/json",
        "-d",
        JSON.stringify({ name: bucket }),
        "http://localhost:4443/storage/v1/b?project=lazuli-local",
      ],
      root,
      capability: "fake-GCS bucket creation",
    });
  }
  const seedRoot = path.join(root, "infra/local/gcs-seed");
  let files;
  try {
    files = await seedFiles(seedRoot);
  } catch (error) {
    if (error.code === "ENOENT") files = [];
    else throw error;
  }
  for (const file of files) {
    const encoded = encodeURIComponent(file.key);
    if (curlStatus(root, `http://localhost:4443/storage/v1/b/${bucket}/o/${encoded}`) === "200") {
      output(`Keeping existing object gs://${bucket}/${file.key}.`);
      continue;
    }
    output(`Uploading missing object gs://${bucket}/${file.key}...`);
    run({
      command: "curl",
      arguments_: [
        "-fsS",
        "-X",
        "POST",
        "--data-binary",
        `@${file.path}`,
        `http://localhost:4443/upload/storage/v1/b/${bucket}/o?uploadType=media&name=${encoded}`,
      ],
      root,
      capability: "fake-GCS object upload",
    });
  }
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
