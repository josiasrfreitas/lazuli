import { readFile } from "node:fs/promises";
import path from "node:path";
import { URL } from "node:url";

import { readWorkspaceMetadata, workspaceResources } from "./workspace-metadata.mjs";
import { runWorkspaceCommand } from "./workspace-full.mjs";

const LOCAL_POSTGRES_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const EXPECTED_CONTAINERS = [
  { name: "lazuli-postgres", service: "postgres" },
  { name: "lazuli-fake-gcs", service: "fake-gcs" },
];
const RESERVED_DATABASES = new Set(["lazuli", "postgres", "hatchet", "template0", "template1"]);
const RESERVED_BUCKETS = new Set(["lazuli-main"]);

function environmentValues(source) {
  const values = new Map();
  for (const line of source.split(/\r?\n/gu)) {
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/u.exec(line);
    if (match === null) continue;
    values.set(match[1], match[2].trim().replace(/^(?:"(.*)"|'(.*)')$/u, "$1$2"));
  }
  return values;
}

function localPostgresUrl(source) {
  let databaseUrl;
  try {
    databaseUrl = new URL(source);
  } catch {
    throw new Error("DATABASE_URL must be a valid local PostgreSQL URL");
  }
  const validProtocol = ["postgres:", "postgresql:"].includes(databaseUrl.protocol);
  const validHost = LOCAL_POSTGRES_HOSTS.has(databaseUrl.hostname);
  const validPort = databaseUrl.port === "" || databaseUrl.port === "5432";
  if (!validProtocol || !validHost || !validPort) {
    throw new Error("DATABASE_URL must target local PostgreSQL on port 5432");
  }
  return databaseUrl;
}

function localGcsUrl(source) {
  let emulator;
  try {
    emulator = new URL(source);
  } catch {
    throw new Error("STORAGE_EMULATOR_HOST must be a valid local URL");
  }
  const validOrigin =
    emulator.protocol === "http:" &&
    LOCAL_POSTGRES_HOSTS.has(emulator.hostname) &&
    emulator.port === "4443";
  if (!validOrigin || !["", "/"].includes(emulator.pathname)) {
    throw new Error("STORAGE_EMULATOR_HOST must target local fake-GCS on port 4443");
  }
}

function assertLocalConfiguration(workspace, source) {
  const values = environmentValues(source);
  const databaseUrl = localPostgresUrl(values.get("DATABASE_URL"));
  if (decodeURIComponent(databaseUrl.pathname.slice(1)) !== workspace.resources.database) {
    throw new Error("DATABASE_URL database does not match workspace metadata");
  }
  if (values.get("GCS_ARTIFACTS_BUCKET") !== workspace.resources.bucket) {
    throw new Error("GCS_ARTIFACTS_BUCKET does not match workspace metadata");
  }
  if (values.get("GCS_PROJECT_ID") !== "lazuli-local") {
    throw new Error("GCS_PROJECT_ID must be lazuli-local");
  }
  localGcsUrl(values.get("STORAGE_EMULATOR_HOST"));
}

function assertComposeContainers(root) {
  for (const expected of EXPECTED_CONTAINERS) {
    const source = runWorkspaceCommand({
      command: "docker",
      arguments_: ["inspect", "-f", "{{json .Config.Labels}}", expected.name],
      root,
      capture: true,
      capability: `${expected.name} identity inspection`,
    });
    let labels;
    try {
      labels = JSON.parse(source);
    } catch {
      throw new Error(`${expected.name} returned invalid Docker labels`);
    }
    if (
      labels?.["com.docker.compose.project"] !== "lazuli" ||
      labels?.["com.docker.compose.service"] !== expected.service ||
      labels?.["com.docker.compose.container-number"] !== "1"
    ) {
      throw new Error(`${expected.name} is not the expected Lazuli Compose service`);
    }
  }
}

export async function assertOwnedFullWorkspace(root) {
  const workspace = await readWorkspaceMetadata(root);
  if (workspace === null) throw new Error("workspace metadata is absent");
  if (workspace.profile !== "full") throw new Error("workspace profile must be full");
  const expected = workspaceResources(workspace.identity);
  if (
    workspace.resources.database !== expected.database ||
    workspace.resources.bucket !== expected.bucket
  ) {
    throw new Error("workspace resources are not exactly derived from its persisted identity");
  }
  if (
    RESERVED_DATABASES.has(workspace.resources.database) ||
    RESERVED_BUCKETS.has(workspace.resources.bucket)
  ) {
    throw new Error("workspace metadata targets a shared local resource");
  }
  const source = await readFile(path.join(root, ".env"), "utf8");
  assertLocalConfiguration(workspace, source);
  assertComposeContainers(root);
  return workspace;
}
