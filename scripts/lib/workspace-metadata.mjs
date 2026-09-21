import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { setTimeout as wait } from "node:timers/promises";

export const WORKSPACE_METADATA_PATH = ".lazuli/workspace.json";
export const WORKSPACE_SCHEMA_VERSION = 2;
export const LEGACY_WORKSPACE_SCHEMA_VERSION = 1;
export const MAX_WORKSPACE_IDENTITY_LENGTH = 56;
export const WEB_PORT_RANGE = { start: 3000, end: 3999 };
export const STORYBOOK_PORT_RANGE = { start: 6006, end: 6999 };
const WORKSPACE_ALLOCATION_LOCK_NAME = "lazuli-workspace-allocation.lock";
const WORKSPACE_ALLOCATION_LOCK_RETRY_MS = 25;
const WORKSPACE_ALLOCATION_LOCK_TIMEOUT_MS = 10_000;

export function normalizeWorkspaceIdentity(directoryName) {
  return directoryName
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, "-")
    .replaceAll(/^-|-$/gu, "");
}

export function workspaceUrls(identity) {
  return {
    web: `http://${identity}.lazuli.localhost`,
    storybook: `http://storybook.${identity}.lazuli.localhost`,
  };
}

function legacyWorkspaceUrls(identity) {
  return {
    web: `http://${identity}.lazuli.localhost`,
    storybook: `http://storybook.${identity}.lazuli.localhost:8080`,
  };
}

function upgradeLegacyWorkspaceUrls(workspace) {
  if (
    workspace?.schemaVersion === WORKSPACE_SCHEMA_VERSION &&
    typeof workspace.identity === "string" &&
    workspace.urls?.web === legacyWorkspaceUrls(workspace.identity).web &&
    workspace.urls.storybook === legacyWorkspaceUrls(workspace.identity).storybook
  ) {
    return { ...workspace, urls: workspaceUrls(workspace.identity) };
  }
  return workspace;
}

export function workspaceResources(identity) {
  return {
    database: `lazuli_${identity.replaceAll("-", "_")}`,
    bucket: `lazuli-${identity}`,
  };
}

function isValidIdentity(identity) {
  return (
    typeof identity === "string" &&
    identity.length <= MAX_WORKSPACE_IDENTITY_LENGTH &&
    identity === normalizeWorkspaceIdentity(identity) &&
    identity.length > 0
  );
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertMetadata(condition, message) {
  if (!condition) throw new Error(message);
}

function isPortInRange(port, range) {
  return Number.isInteger(port) && port >= range.start && port <= range.end;
}

function validateUrls(urls, identity) {
  const expected = workspaceUrls(identity);
  return isRecord(urls) && urls.web === expected.web && urls.storybook === expected.storybook;
}

function validatePorts(ports) {
  return (
    isRecord(ports) &&
    isPortInRange(ports.web, WEB_PORT_RANGE) &&
    isPortInRange(ports.storybook, STORYBOOK_PORT_RANGE) &&
    ports.web !== ports.storybook
  );
}

function validateResources(resources, identity) {
  const expected = workspaceResources(identity);
  return (
    isRecord(resources) &&
    resources.database === expected.database &&
    resources.bucket === expected.bucket
  );
}

export function validateWorkspaceMetadata(workspace) {
  assertMetadata(isRecord(workspace), "workspace metadata must be an object");
  assertMetadata(
    [LEGACY_WORKSPACE_SCHEMA_VERSION, WORKSPACE_SCHEMA_VERSION].includes(workspace.schemaVersion),
    `unsupported workspace metadata schema version: ${workspace.schemaVersion}`,
  );
  assertMetadata(
    workspace.profile === "light" || workspace.profile === "full",
    `unsupported workspace profile: ${workspace.profile}`,
  );
  assertMetadata(
    typeof workspace.initialTechnicalPath === "string" &&
      path.isAbsolute(workspace.initialTechnicalPath),
    "workspace metadata has no absolute initialTechnicalPath",
  );
  assertMetadata(isValidIdentity(workspace.identity), "workspace metadata has an invalid identity");
  assertMetadata(
    validateUrls(workspace.urls, workspace.identity),
    "workspace metadata has URLs inconsistent with its identity",
  );
  assertMetadata(validatePorts(workspace.ports), "workspace metadata has invalid port allocations");
  assertMetadata(
    validateResources(workspace.resources, workspace.identity),
    "workspace metadata has resources inconsistent with its identity",
  );
  if (workspace.schemaVersion === WORKSPACE_SCHEMA_VERSION) {
    assertMetadata(
      typeof workspace.ownershipToken === "string" &&
        /^[0-9a-f]{8}-[0-9a-f-]{27,}$/u.test(workspace.ownershipToken),
      "workspace metadata has an invalid ownership token",
    );
  }
  return workspace;
}

export function migrateWorkspaceMetadata(workspace) {
  if (workspace.schemaVersion === WORKSPACE_SCHEMA_VERSION) return workspace;
  return {
    ...workspace,
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    ownershipToken: randomUUID(),
  };
}

export async function readWorkspaceMetadata(root) {
  const metadataPath = path.join(root, WORKSPACE_METADATA_PATH);
  let source;
  try {
    source = await readFile(metadataPath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
  let workspace;
  try {
    workspace = JSON.parse(source);
  } catch {
    throw new Error(`invalid workspace metadata at ${metadataPath}: invalid JSON`);
  }
  workspace = upgradeLegacyWorkspaceUrls(workspace);
  try {
    return validateWorkspaceMetadata(workspace);
  } catch (error) {
    throw new Error(`invalid workspace metadata at ${metadataPath}: ${error.message}`, {
      cause: error,
    });
  }
}

function worktreePaths(root) {
  const result = spawnSync("git", ["worktree", "list", "--porcelain"], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.status !== 0) return [root];
  return result.stdout
    .split("\n")
    .filter((line) => line.startsWith("worktree "))
    .map((line) => path.resolve(line.slice("worktree ".length)));
}

function workspaceAllocationLockPath(root) {
  const result = spawnSync("git", ["rev-parse", "--git-common-dir"], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error("could not locate the shared Git directory for workspace allocation");
  }
  return path.join(path.resolve(root, result.stdout.trim()), WORKSPACE_ALLOCATION_LOCK_NAME);
}

export async function withWorkspaceAllocationLock(root, callback) {
  const lockPath = workspaceAllocationLockPath(root);
  const deadline = Date.now() + WORKSPACE_ALLOCATION_LOCK_TIMEOUT_MS;
  while (true) {
    try {
      await mkdir(lockPath);
      break;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      if (Date.now() >= deadline) {
        throw new Error(
          "timed out waiting for another workspace setup to finish allocating identity and ports",
          { cause: error },
        );
      }
      await wait(WORKSPACE_ALLOCATION_LOCK_RETRY_MS);
    }
  }
  try {
    return await callback();
  } finally {
    await rm(lockPath, { force: true, recursive: true });
  }
}

export async function registeredWorkspaces(root) {
  const currentRoot = path.resolve(root);
  const workspaces = [];
  for (const worktree of worktreePaths(root)) {
    if (path.resolve(worktree) === currentRoot) continue;
    const workspace = await readWorkspaceMetadata(worktree);
    if (workspace !== null) workspaces.push({ path: worktree, workspace });
  }
  return workspaces;
}

export async function isPortAvailable(port) {
  return await new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen({ port, host: "127.0.0.1", exclusive: true });
  });
}

export async function findAvailablePort(range, reservedPorts) {
  for (let port = range.start; port <= range.end; port += 1) {
    if (!reservedPorts.has(port) && (await isPortAvailable(port))) return port;
  }
  throw new Error(`no available port in ${range.start}-${range.end}`);
}
