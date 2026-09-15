import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";

export const WORKSPACE_METADATA_PATH = ".lazuli/workspace.json";
export const WORKSPACE_SCHEMA_VERSION = 1;
export const MAX_WORKSPACE_IDENTITY_LENGTH = 56;
export const WEB_PORT_RANGE = { start: 3000, end: 3999 };
export const STORYBOOK_PORT_RANGE = { start: 6006, end: 6999 };

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
    workspace.schemaVersion === WORKSPACE_SCHEMA_VERSION,
    `unsupported workspace metadata schema version: ${workspace.schemaVersion}`,
  );
  assertMetadata(
    workspace.profile === "light",
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
  return workspace;
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
