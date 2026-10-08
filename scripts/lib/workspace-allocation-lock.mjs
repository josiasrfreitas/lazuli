import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as wait } from "node:timers/promises";

const RETRY_MS = 25;
const TIMEOUT_MS = 10_000;

function processStartedAt(pid) {
  const result = spawnSync("ps", ["-p", String(pid), "-o", "lstart="], { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : null;
}

function isLive(owner) {
  return (
    Number.isInteger(owner.pid) &&
    typeof owner.startedAt === "string" &&
    processStartedAt(owner.pid) === owner.startedAt
  );
}

async function readOwner(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function contenders(directory) {
  const result = [];
  for (const name of await readdir(directory)) {
    if (!name.endsWith(".json")) continue;
    const file = path.join(directory, name);
    const owner = await readOwner(file);
    if (!owner) continue;
    if (!isLive(owner)) {
      // Names are unique and never reused, so deleting this dead contender
      // cannot remove a replacement owner's record.
      await rm(file, { force: true });
      continue;
    }
    result.push({ ...owner, name });
  }
  return result;
}

async function publish(file, owner) {
  await writeFile(`${file}.tmp`, JSON.stringify(owner));
  await rename(`${file}.tmp`, file);
}

async function retry(deadline) {
  if (Date.now() >= deadline)
    throw new Error(
      "timed out waiting for another workspace setup to finish allocating identity and ports",
    );
  await wait(RETRY_MS);
}

async function recoverLegacyOwner(directory, ownersDirectory) {
  const owner = await readOwner(path.join(directory, "owner.json"));
  // Ownerless directories belong to the original mkdir-only protocol. We
  // cannot infer that their owner died, so leave them in place.
  if (!owner || isLive(owner)) return false;
  await rm(directory, { force: true, recursive: true });
  if (
    typeof owner.name === "string" &&
    owner.name.endsWith(".json") &&
    path.basename(owner.name) === owner.name
  )
    await rm(path.join(ownersDirectory, owner.name), { force: true, recursive: true });
  return true;
}

async function withLegacyAllocationLock({ directory, owner, deadline }, callback) {
  const ownersDirectory = `${directory}.owners`;
  const candidate = path.join(ownersDirectory, owner.name);
  await mkdir(candidate, { recursive: true });
  let acquired = false;
  try {
    await writeFile(path.join(candidate, "owner.json"), JSON.stringify(owner));
    while (!acquired) {
      try {
        // A prepared symlink claims the same pathname as legacy mkdir callers
        // atomically, with owner metadata already present even if we die now.
        await symlink(candidate, directory);
        acquired = true;
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
        if (!(await recoverLegacyOwner(directory, ownersDirectory))) await retry(deadline);
      }
    }
    return await callback();
  } finally {
    if (acquired) await rm(directory, { force: true, recursive: true });
    await rm(candidate, { force: true, recursive: true });
  }
}

async function waitForTurn({ directory, deadline }, own) {
  while (true) {
    const others = await contenders(directory);
    const blocked = others.some(
      (other) =>
        other.name !== own.name &&
        (other.choosing ||
          other.ticket < own.ticket ||
          (other.ticket === own.ticket && other.name < own.name)),
    );
    if (!blocked) return;
    await retry(deadline);
  }
}

/** Lamport's bakery protocol: publish intent, choose a ticket, then wait in order. */
export async function withAllocationQueue({ directory, legacyDirectory }, callback) {
  // The queue directory stays in place. Records are unique; only the queue
  // winner can acquire or recover the shared legacy gate.
  await mkdir(directory, { recursive: true });
  const deadline = Date.now() + TIMEOUT_MS;
  const name = `${process.pid}-${randomUUID()}.json`;
  const file = path.join(directory, name);
  const owner = {
    name,
    pid: process.pid,
    startedAt: processStartedAt(process.pid),
    choosing: true,
    ticket: 0,
  };
  if (!owner.startedAt) throw new Error("could not identify the workspace allocation process");
  try {
    await publish(file, owner);
    const waiting = await contenders(directory);
    owner.ticket = Math.max(0, ...waiting.map((entry) => entry.ticket)) + 1;
    owner.choosing = false;
    await publish(file, owner);
    await waitForTurn({ directory, deadline }, { ...owner, name });
    return await withLegacyAllocationLock(
      { directory: legacyDirectory, owner, deadline },
      callback,
    );
  } finally {
    await rm(file, { force: true });
    await rm(`${file}.tmp`, { force: true });
  }
}
