import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { hostname } from "node:os";
import path from "node:path";

export const DATABASE_PREFIX = "lazuli_hook_";
const POSTGRES_CONTAINER = "lazuli-postgres";
const ADMIN_USER = "lazuli";
const ADMIN_DATABASE = "postgres";

export function createDatabaseIdentity({
  workspaceIdentity,
  token = randomBytes(6).toString("hex"),
}) {
  const safeIdentity =
    workspaceIdentity
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/gu, "_")
      .replaceAll(/^_+|_+$/gu, "") || "workspace";
  const suffix = `_${token
    .toLowerCase()
    .replaceAll(/[^a-z0-9]/gu, "")
    .slice(0, 12)}`;
  return `${DATABASE_PREFIX}${safeIdentity.slice(0, 63 - DATABASE_PREFIX.length - suffix.length)}${suffix}`;
}

export function validateTemporaryDatabaseName(name) {
  if (!/^lazuli_hook_[a-z0-9_]+$/u.test(name) || name.length > 63)
    throw new Error(`Unsafe temporary database name: ${name}`);
  return name;
}

function docker(args, options = {}) {
  return spawnSync("docker", args, { encoding: "utf8", ...options });
}

function fail(capability, command, detail = "") {
  throw new Error(
    `${capability} is unavailable. No service was started automatically. Run: ${command}${detail ? `\n${detail.trim()}` : ""}`,
  );
}

export function preflightInfrastructure({ mailpit = false, fakeGcs = false } = {}) {
  const version = docker(["version", "--format", "{{.Server.Version}}"]);
  if (version.status !== 0) fail("Docker", "docker info", version.stderr);
  assertContainer("Postgres", POSTGRES_CONTAINER, "postgres", "docker compose up -d postgres");
  const admin = psql(["-d", ADMIN_DATABASE, "-Atqc", "SELECT 1"]);
  if (admin.status !== 0)
    fail("Postgres administrative connection", "docker compose up -d postgres", admin.stderr);
  if (mailpit)
    assertContainer(
      "Mailpit",
      "lazuli-mailpit",
      "mailpit",
      "docker compose up -d postgres mailpit",
    );
  if (fakeGcs)
    assertContainer(
      "fake-GCS",
      "lazuli-fake-gcs",
      "fake-gcs",
      "docker compose up -d postgres fake-gcs",
    );
}

function assertContainer(capability, container, service, command) {
  const result = docker([
    "inspect",
    "--format",
    '{{.State.Status}}|{{.State.Health.Status}}|{{index .Config.Labels "com.docker.compose.project"}}|{{index .Config.Labels "com.docker.compose.service"}}',
    container,
  ]);
  if (result.status !== 0) fail(capability, command, result.stderr);
  const [status, health, project, actualService] = result.stdout.trim().split("|");
  if (
    status !== "running" ||
    health !== "healthy" ||
    project !== "lazuli" ||
    actualService !== service
  ) {
    fail(
      capability,
      command,
      `Expected healthy ${container} with Compose labels lazuli/${service}; received ${result.stdout.trim()}.`,
    );
  }
}

function psql(args, options = {}) {
  return docker(
    ["exec", "-i", POSTGRES_CONTAINER, "psql", "-v", "ON_ERROR_STOP=1", "-U", ADMIN_USER, ...args],
    options,
  );
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}
function identifier(value) {
  validateTemporaryDatabaseName(value);
  return `"${value}"`;
}

export function createEphemeralDatabase({
  workspaceIdentity,
  technicalPath = process.cwd(),
  pid = process.pid,
  token,
  now = new Date(),
}) {
  const name = createDatabaseIdentity({ workspaceIdentity, token });
  const ownership = JSON.stringify({
    kind: "lazuli-pre-push",
    workspaceIdentity,
    technicalPath: path.resolve(technicalPath),
    pid,
    host: hostname(),
    token: name.slice(-12),
    createdAt: now.toISOString(),
  });
  const result = psql([
    "-d",
    ADMIN_DATABASE,
    "-c",
    `CREATE DATABASE ${identifier(name)};`,
    "-c",
    `COMMENT ON DATABASE ${identifier(name)} IS ${sqlLiteral(ownership)};`,
  ]);
  if (result.status !== 0) {
    const cleanup = psql([
      "-d",
      ADMIN_DATABASE,
      "-c",
      `DROP DATABASE IF EXISTS ${identifier(name)};`,
    ]);
    throw new Error(
      `Could not create temporary database ${name}.\n${result.stderr.trim()}${cleanup.status === 0 ? "" : `\nRollback cleanup also failed: ${cleanup.stderr.trim()}`}`,
    );
  }
  return { name, ownership, url: `postgresql://${ADMIN_USER}:lazuli@127.0.0.1:5432/${name}` };
}

export function dropEphemeralDatabase(database) {
  validateTemporaryDatabaseName(database.name);
  const result = psql([
    "-d",
    ADMIN_DATABASE,
    "-c",
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = ${sqlLiteral(database.name)} AND pid <> pg_backend_pid();`,
    "-c",
    `DROP DATABASE ${identifier(database.name)};`,
  ]);
  if (result.status !== 0)
    throw new Error(
      `Cleanup failed for ${database.name}. Diagnose with: docker exec ${POSTGRES_CONTAINER} psql -U ${ADMIN_USER} -d postgres -c "SELECT datname FROM pg_database WHERE datname LIKE 'lazuli_hook_%';"\n${result.stderr.trim()}`,
    );
}

export function reapProvenOrphans({ isProcessAlive = defaultProcessAlive } = {}) {
  const query = `SELECT datname, obj_description(oid, 'pg_database') FROM pg_database WHERE datname LIKE '${DATABASE_PREFIX}%';`;
  const result = psql(["-d", ADMIN_DATABASE, "-At", "-F", "\t", "-c", query]);
  if (result.status !== 0)
    throw new Error(`Could not inspect abandoned temporary databases.\n${result.stderr.trim()}`);
  const report = { removed: [], preserved: [] };
  for (const line of result.stdout.trim().split("\n").filter(Boolean)) {
    const [name, comment] = line.split("\t");
    let owner;
    try {
      owner = JSON.parse(comment);
    } catch {
      report.preserved.push(name);
      continue;
    }
    if (!isValidOwnership({ name, owner }) || isProcessAlive(owner.pid)) {
      report.preserved.push(name);
      continue;
    }
    dropEphemeralDatabase({ name });
    report.removed.push(name);
  }
  return report;
}

export function isValidOwnership({ name, owner }) {
  return (
    owner?.kind === "lazuli-pre-push" &&
    owner.host === hostname() &&
    Number.isInteger(owner.pid) &&
    owner.pid > 0 &&
    typeof owner.technicalPath === "string" &&
    path.isAbsolute(owner.technicalPath) &&
    typeof owner.createdAt === "string" &&
    !Number.isNaN(Date.parse(owner.createdAt)) &&
    typeof owner.token === "string" &&
    name.endsWith(`_${owner.token}`)
  );
}

function defaultProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}
