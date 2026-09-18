import { execFileSync } from "node:child_process";
import { access, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { bucketOwnership, bucketOwnershipLabels, bucketOwnershipObjectName } from "./workspace-full.mjs";
import {
  registeredWorkspaces,
  withWorkspaceAllocationLock,
  workspaceResources,
} from "./workspace-metadata.mjs";
import { teardownWorkspaceLeases } from "./workspace-proxy.mjs";

const JOURNAL_DIRECTORY = "lazuli-workspace-orphans";
const POSTGRES_CONTAINER = "lazuli-postgres";

function run({ root, command, arguments_ }) {
  return execFileSync(command, arguments_, { cwd: root, encoding: "utf8" }).trim();
}

function commonGitDirectory(root) {
  return path.resolve(root, run({ root, command: "git", arguments_: ["rev-parse", "--git-common-dir"] }));
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function expectedOwnership(workspace) {
  return [workspace.ownershipToken, workspace.identity, workspace.initialTechnicalPath].join("|");
}

async function pathExists(target) {
  try {
    await access(target);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function writeJournal(file, journal) {
  await writeFile(file, `${JSON.stringify({ ...journal, updatedAt: new Date().toISOString() }, null, 2)}\n`);
}

function expectedComposeServices(root) {
  for (const [name, service] of [[POSTGRES_CONTAINER, "postgres"], ["lazuli-fake-gcs", "fake-gcs"]]) {
    let labels;
    try {
      labels = JSON.parse(run({ root, command: "docker", arguments_: ["inspect", "-f", "{{json .Config.Labels}}", name] }));
    } catch {
      return `${name} is not observable as Lazuli's local Compose service`;
    }
    if (labels?.["com.docker.compose.project"] !== "lazuli" || labels?.["com.docker.compose.service"] !== service || labels?.["com.docker.compose.container-number"] !== "1") {
      return `${name} does not have Lazuli's expected Compose labels`;
    }
  }
  return null;
}

function databaseExists(root, database) {
  return run({ root, command: "docker", arguments_: ["exec", POSTGRES_CONTAINER, "psql", "-U", "lazuli", "-d", "postgres", "-tAc", `SELECT 1 FROM pg_database WHERE datname = ${sqlLiteral(database)}`] }) === "1";
}

function databaseOwned(root, workspace) {
  const value = run({ root, command: "docker", arguments_: ["exec", POSTGRES_CONTAINER, "psql", "-U", "lazuli", "-d", workspace.resources.database, "-tAc", "SELECT ownership_token || '|' || workspace_identity || '|' || technical_path FROM lazuli_local.workspace_ownership WHERE singleton = true"] });
  return value === expectedOwnership(workspace);
}

function dropDatabase(root, database) {
  run({ root, command: "docker", arguments_: ["exec", POSTGRES_CONTAINER, "psql", "-U", "lazuli", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", `DROP DATABASE ${database} WITH (FORCE)`] });
}

function bucketStatus(root, bucket) {
  return run({ root, command: "curl", arguments_: ["-sS", "-o", "/dev/null", "-w", "%{http_code}", `http://localhost:4443/storage/v1/b/${bucket}?project=lazuli-local`] });
}

function bucketOwned(root, workspace) {
  const bucket = workspace.resources.bucket;
  const metadata = JSON.parse(run({ root, command: "curl", arguments_: ["-fsS", `http://localhost:4443/storage/v1/b/${bucket}?project=lazuli-local`] }));
  const labels = metadata.labels ?? {};
  const labelsMatch = Object.entries(bucketOwnershipLabels(workspace)).every(([key, value]) => labels[key] === value);
  const marker = JSON.parse(run({ root, command: "curl", arguments_: ["-fsS", `http://localhost:4443/storage/v1/b/${bucket}/o/${encodeURIComponent(bucketOwnershipObjectName())}?alt=media`] }));
  return labelsMatch && JSON.stringify(marker) === JSON.stringify(bucketOwnership(workspace));
}

function deleteBucket(root, bucket) {
  const listing = JSON.parse(run({ root, command: "curl", arguments_: ["-fsS", `http://localhost:4443/storage/v1/b/${bucket}/o?project=lazuli-local`] }));
  for (const object of listing.items ?? []) run({ root, command: "curl", arguments_: ["-fsS", "-X", "DELETE", `http://localhost:4443/storage/v1/b/${bucket}/o/${encodeURIComponent(object.name)}`] });
  run({ root, command: "curl", arguments_: ["-fsS", "-X", "DELETE", `http://localhost:4443/storage/v1/b/${bucket}`] });
}

async function activeWorkspaceState(root) {
  const registered = await registeredWorkspaces(root);
  const paths = run({ root, command: "git", arguments_: ["worktree", "list", "--porcelain"] })
    .split("\n")
    .filter((line) => line.startsWith("worktree "))
    .map((line) => path.resolve(line.slice("worktree ".length)));
  return { registered, paths };
}

async function orphanReason({ workspace, active }) {
  if (path.resolve(workspace.initialTechnicalPath) !== workspace.initialTechnicalPath) return "technical path is not canonical";
  if (await pathExists(workspace.initialTechnicalPath)) return "owner technical path still exists";
  if (active.paths.includes(workspace.initialTechnicalPath)) return "owner technical path remains registered by Git";
  const collision = active.registered.find(({ path: activePath, workspace: other }) => activePath === workspace.initialTechnicalPath || other.identity === workspace.identity || other.resources.database === workspace.resources.database || other.resources.bucket === workspace.resources.bucket);
  return collision === undefined ? null : `collides with active worktree ${collision.path}`;
}

function resourceNamesMatch(workspace) {
  const expected = workspaceResources(workspace.identity);
  return workspace.resources?.database === expected.database && workspace.resources?.bucket === expected.bucket;
}

function hasJournalEnvelope(journal) {
  return (
    journal?.version === 1 &&
    Array.isArray(journal.pending) &&
    journal.workspace !== null &&
    typeof journal.workspace === "object"
  );
}

function hasValidWorkspaceIdentity(workspace) {
  return (
    typeof workspace.identity === "string" &&
    typeof workspace.ownershipToken === "string" &&
    typeof workspace.initialTechnicalPath === "string" &&
    resourceNamesMatch(workspace)
  );
}

function validateJournal(journal) {
  const workspace = journal?.workspace;
  if (!hasJournalEnvelope(journal)) return "journal is invalid or has no recoverable workspace identity";
  if (!hasValidWorkspaceIdentity(workspace)) return "journal workspace identity is invalid or resource names are not derived exactly";
  return null;
}

async function complete({ file, journal, step }) {
  journal.pending = journal.pending.filter((candidate) => candidate !== step);
  journal.failures = (journal.failures ?? []).filter((failure) => failure.step !== step);
  await writeJournal(file, journal);
}

async function fail({ file, journal, step, error }) {
  journal.failures = (journal.failures ?? []).filter((failure) => failure.step !== step);
  journal.failures.push({ step, message: error.message });
  await writeJournal(file, journal);
}

function assertLocalServices(root) {
  const problem = expectedComposeServices(root);
  if (problem !== null) throw new Error(problem);
}

async function pruneProcesses({ root, workspace }) {
  const failures = await teardownWorkspaceLeases(root, workspace);
  if (failures.length > 0) throw new Error(failures.join("; "));
}

function pruneDatabase({ root, workspace }) {
  assertLocalServices(root);
  if (!databaseExists(root, workspace.resources.database)) return;
  if (!databaseOwned(root, workspace)) throw new Error("database ownership marker is absent or does not match; preserved");
  dropDatabase(root, workspace.resources.database);
}

function pruneBucket({ root, workspace }) {
  assertLocalServices(root);
  if (bucketStatus(root, workspace.resources.bucket) !== "200") return;
  if (!bucketOwned(root, workspace)) throw new Error("bucket ownership markers are absent or do not match; preserved");
  deleteBucket(root, workspace.resources.bucket);
}

async function performStep({ root, workspace, step }) {
  switch (step) {
    case "processes": {
      await pruneProcesses({ root, workspace });
      return;
    }
    case "database": {
      pruneDatabase({ root, workspace });
      return;
    }
    case "bucket": {
      pruneBucket({ root, workspace });
    }
  }
}

async function revalidateOrphan(root, workspace) {
  const active = await activeWorkspaceState(root);
  const reason = await orphanReason({ workspace, active });
  if (reason !== null) throw new Error(reason);
}

function stepNeedsAllocationLock(step) {
  return step === "database" || step === "bucket";
}

async function performVerifiedStep({ root, file, journal, step }) {
  await revalidateOrphan(root, journal.workspace);
  await performStep({ root, workspace: journal.workspace, step });
  await complete({ file, journal, step });
}

async function pruneStep({ root, file, journal, step, output }) {
  try {
    const operation = () => performVerifiedStep({ root, file, journal, step });
    await (stepNeedsAllocationLock(step) ? withWorkspaceAllocationLock(root, operation) : operation());
  } catch (error) {
    await fail({ file, journal, step, error });
    output(`preserved ${journal.workspace.identity} ${step}: ${error.message}`);
  }
}

async function finishPrune({ file, journal, output }) {
  if (journal.pending.length > 0) return { incomplete: true };
  await rm(file);
  output(`collected ${journal.workspace.identity}`);
  return { incomplete: false };
}

async function pruneJournal({ root, file, journal, active, output }) {
  const reason = await orphanReason({ workspace: journal.workspace, active });
  if (reason !== null) return { incomplete: true, reason };
  for (const step of journal.pending) await pruneStep({ root, file, journal, step, output });
  return await finishPrune({ file, journal, output });
}

async function journalNames(directory) {
  try {
    const entries = await readdir(directory);
    return entries.filter((name) => name.endsWith(".json")).toSorted();
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function readCandidate({ file, name, output }) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    output(`preserved ${name}: journal is invalid and requires manual recovery`);
    return null;
  }
}

async function collectCandidate({ root, file, name, active, prune, output }) {
  const journal = await readCandidate({ file, name, output });
  if (journal === null) return prune;
  const invalid = validateJournal(journal);
  if (invalid !== null) {
    output(`preserved ${name}: ${invalid}; manual recovery required`);
    return prune;
  }
  const reason = await orphanReason({ workspace: journal.workspace, active });
  if (reason !== null) {
    output(`preserved ${journal.workspace.identity}: ${reason}; manual recovery required`);
    return prune;
  }
  if (!prune) {
    output(`orphan candidate ${journal.workspace.identity}: inspection only; run pnpm workspace:gc --prune to collect`);
    return false;
  }
  const result = await pruneJournal({ root, file, journal, active, output });
  return result.incomplete;
}

async function observableActiveWorkspaces({ root, output }) {
  try {
    return await activeWorkspaceState(root);
  } catch (error) {
    output(`preserved all candidates: active worktrees are not observable (${error.message})`);
    return null;
  }
}

export async function collectOrphanedWorkspaces(root, { prune = false, output = () => {} } = {}) {
  const directory = path.join(commonGitDirectory(root), JOURNAL_DIRECTORY);
  const names = await journalNames(directory);
  if (names === null) {
    output("No orphaned workspace journals found.");
    return { incomplete: false };
  }
  const active = await observableActiveWorkspaces({ root, output });
  if (active === null) return { incomplete: prune };
  let incomplete = false;
  for (const name of names) {
    incomplete ||= await collectCandidate({ root, file: path.join(directory, name), name, active, prune, output });
  }
  return { incomplete };
}
