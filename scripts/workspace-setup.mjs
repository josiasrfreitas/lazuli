import { execFileSync } from "node:child_process";
import { copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { URL } from "node:url";

import {
  findAvailablePort,
  MAX_WORKSPACE_IDENTITY_LENGTH,
  normalizeWorkspaceIdentity,
  readWorkspaceMetadata,
  registeredWorkspaces,
  withWorkspaceAllocationLock,
  workspaceResources,
  workspaceUrls,
  WORKSPACE_METADATA_PATH,
  WORKSPACE_SCHEMA_VERSION,
  STORYBOOK_PORT_RANGE,
  WEB_PORT_RANGE,
} from "./lib/workspace-metadata.mjs";
import {
  dependenciesNeedInstall,
  ensureBucket,
  ensureDatabase,
  reconcileCompose,
  withFullSetupLock,
} from "./lib/workspace-full.mjs";

const root = process.cwd();
const SETUP_ARGUMENT_COUNT = 3;

function output(message) {
  process.stdout.write(`${message}\n`);
}

function errorOutput(message) {
  process.stderr.write(`${message}\n`);
}

function usage() {
  errorOutput("Usage: pnpm workspace:setup <light|full>");
}

function patchEnvironment(source, values) {
  const remaining = new Map(Object.entries(values));
  const lines = source.split(/\r?\n/gu).map((line) => {
    const match = /^([A-Z][A-Z0-9_]*)=/u.exec(line);
    if (match !== null && remaining.has(match[1])) {
      const value = remaining.get(match[1]);
      remaining.delete(match[1]);
      return `${match[1]}=${value}`;
    }
    return line;
  });
  for (const [key, value] of remaining) lines.push(`${key}=${value}`);
  return `${lines.filter((line, index) => line !== "" || index < lines.length - 1).join("\n")}\n`;
}

function environmentValue(source, key) {
  const prefix = `${key}=`;
  return source
    .split(/\r?\n/gu)
    .find((line) => line.startsWith(prefix))
    ?.slice(prefix.length)
    .trim()
    .replace(/^(["'])(.*)\1$/u, "$2");
}

function databaseUrlForWorkspace(existingUrl, database) {
  if (existingUrl !== undefined) {
    try {
      const url = new URL(existingUrl);
      if (url.protocol === "postgresql:" || url.protocol === "postgres:") {
        url.pathname = `/${database}`;
        return url.toString();
      }
    } catch {
      // Fall back to the documented local connection when the existing value is not a URL.
    }
  }
  return `postgresql://lazuli:lazuli@localhost:5432/${database}?schema=public`;
}

async function configureEnvironment(workspace) {
  const environmentPath = path.join(root, ".env");
  let source;
  try {
    source = await readFile(environmentPath, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await copyFile(path.join(root, ".env.example"), environmentPath);
    source = await readFile(environmentPath, "utf8");
  }
  const environment = patchEnvironment(source, {
    APP_URL: workspace.urls.web,
    BETTER_AUTH_URL: workspace.urls.web,
    DATABASE_URL: databaseUrlForWorkspace(
      environmentValue(source, "DATABASE_URL"),
      workspace.resources.database,
    ),
    GCS_ARTIFACTS_BUCKET: workspace.resources.bucket,
    LAZULI_STORYBOOK_PORT: String(workspace.ports.storybook),
    LAZULI_WEB_PORT: String(workspace.ports.web),
  });
  await writeFile(environmentPath, environment);
}

async function createWorkspace() {
  const identity = normalizeWorkspaceIdentity(path.basename(root));
  if (identity.length === 0)
    throw new Error("workspace directory name normalizes to an empty identity");
  if (identity.length > MAX_WORKSPACE_IDENTITY_LENGTH) {
    throw new Error(
      `workspace identity exceeds ${MAX_WORKSPACE_IDENTITY_LENGTH} characters: ${identity}`,
    );
  }

  return await withWorkspaceAllocationLock(root, async () => {
    const registered = await registeredWorkspaces(root);
    const collision = registered.find(({ workspace }) => workspace.identity === identity);
    if (collision !== undefined) {
      throw new Error(
        `workspace identity '${identity}' already belongs to registered worktree ${collision.path}`,
      );
    }
    const reservedPorts = new Set(
      registered.flatMap(({ workspace }) => [workspace.ports.web, workspace.ports.storybook]),
    );
    const web = await findAvailablePort(WEB_PORT_RANGE, reservedPorts);
    reservedPorts.add(web);
    const storybook = await findAvailablePort(STORYBOOK_PORT_RANGE, reservedPorts);
    const workspace = {
      schemaVersion: WORKSPACE_SCHEMA_VERSION,
      initialTechnicalPath: path.resolve(root),
      identity,
      profile: "light",
      urls: workspaceUrls(identity),
      ports: { web, storybook },
      resources: workspaceResources(identity),
    };
    await persistWorkspace(workspace);
    return workspace;
  });
}

async function persistWorkspace(workspace) {
  const target = path.join(root, WORKSPACE_METADATA_PATH);
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(workspace, null, 2)}\n`);
  await rename(temporary, target);
}

async function prepareDependencies(workspace) {
  await configureEnvironment(workspace);
  if (await dependenciesNeedInstall(root)) {
    output("Installing dependencies...");
    execFileSync("pnpm", ["install"], { cwd: root, stdio: "inherit" });
  } else {
    output("Dependencies already match pnpm-lock.yaml.");
  }
}

async function setupLight() {
  let workspace = await readWorkspaceMetadata(root);
  if (workspace === null) {
    workspace = await createWorkspace();
    output(`Created light workspace metadata for ${workspace.identity}.`);
  } else {
    output(`Using existing ${workspace.profile} workspace metadata for ${workspace.identity}.`);
    await persistWorkspace(workspace);
  }
  await prepareDependencies(workspace);
  output("Light workspace setup complete.");
}

async function setupFull() {
  await withFullSetupLock(root, async () => {
    let workspace = await readWorkspaceMetadata(root);
    if (workspace === null) {
      throw new Error("workspace metadata is absent; run pnpm workspace:setup light first");
    }
    if (workspace.profile === "full") {
      output(`Resuming full workspace setup for ${workspace.identity}.`);
      await persistWorkspace(workspace);
    } else {
      workspace = { ...workspace, profile: "full" };
      await persistWorkspace(workspace);
      output(`Promoted workspace metadata for ${workspace.identity} to full.`);
    }
    await prepareDependencies(workspace);
    await reconcileCompose(root, output);
    await ensureDatabase({ root, workspace, output });
    await ensureBucket({ root, workspace, output });
    output("Full workspace setup complete.");
  });
}

async function main() {
  if (process.argv.length === SETUP_ARGUMENT_COUNT && ["light", "full"].includes(process.argv[2])) {
    await (process.argv[2] === "full" ? setupFull() : setupLight());
    return;
  }
  usage();
  process.exitCode = 2;
}

try {
  await main();
} catch (error) {
  errorOutput(`workspace:setup failed: ${error.message}`);
  if (process.argv[2] === "full") {
    errorOutput("Inspect shared services with: docker compose ps");
    errorOutput("Inspect a service with: docker compose logs <service>");
    errorOutput("Resume safely with: pnpm workspace:setup full");
  }
  process.exitCode = 1;
}
