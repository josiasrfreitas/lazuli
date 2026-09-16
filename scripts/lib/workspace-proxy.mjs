import { execFileSync, spawn } from "node:child_process";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import path from "node:path";
import { setTimeout as wait } from "node:timers/promises";

import { withWorkspaceAllocationLock } from "./workspace-metadata.mjs";

const DEFAULT_CADDY_ADMIN_PORT = 2019;
const DEFAULT_CADDY_HTTP_PORT = 80;
const CADDY_ADMIN_PORT = Number(process.env.LAZULI_CADDY_ADMIN_PORT ?? DEFAULT_CADDY_ADMIN_PORT);
const CADDY_HTTP_PORT = Number(process.env.LAZULI_CADDY_HTTP_PORT ?? DEFAULT_CADDY_HTTP_PORT);
const CADDY_ADMIN_URL = `http://127.0.0.1:${CADDY_ADMIN_PORT}`;
const CADDY_CONFIG_NAME = "lazuli-caddy.json";
const CADDY_SERVER_NAME = "lazuli_storybook_proxy_v1";
const LEGACY_CADDY_SERVER_NAME = "lazuli";
const CADDY_ROUTE_MARKER = "lazuli-storybook-proxy-v1-marker";
const LEASES_DIRECTORY = "lazuli-proxy-leases";
const LEASE_VERSION = 1;
const REQUEST_TIMEOUT_MS = 1000;
const CADDY_START_SETTLE_MS = 250;
const CADDY_START_ATTEMPTS = 10;
const CADDY_START_RETRY_MS = 100;
const HTTP_SERVER_ERROR_START = 500;

function sharedStateDirectory(root) {
  if (process.env.LAZULI_PROXY_STATE_DIR) return path.resolve(process.env.LAZULI_PROXY_STATE_DIR);
  const result = execFileSync("git", ["rev-parse", "--git-common-dir"], {
    cwd: root,
    encoding: "utf8",
  });
  return path.resolve(root, result.trim());
}

function request(url, options = {}) {
  const signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  return fetch(url, { ...options, signal });
}

function caddyAdminRequest(pathname, options = {}) {
  return request(`${CADDY_ADMIN_URL}${pathname}`, {
    ...options,
    headers: { origin: CADDY_ADMIN_URL, ...options.headers },
  });
}

function caddyConfiguration(routes) {
  return {
    admin: { listen: `127.0.0.1:${CADDY_ADMIN_PORT}` },
    apps: {
      http: {
        servers: {
          [CADDY_SERVER_NAME]: {
            listen: [`127.0.0.1:${CADDY_HTTP_PORT}`],
            automatic_https: { disable: true },
            routes: [
              {
                "@id": CADDY_ROUTE_MARKER,
                match: [{ host: ["lazuli-proxy.invalid"] }],
                handle: [{ handler: "static_response", status_code: 404 }],
              },
              ...routes,
              {
                handle: [{ handler: "static_response", status_code: 404 }],
              },
            ],
          },
        },
      },
    },
  };
}

function routeForLease(lease) {
  return {
    match: [{ host: [lease.hostname] }],
    handle: [
      {
        handler: "reverse_proxy",
        upstreams: [{ dial: `127.0.0.1:${lease.port}` }],
      },
    ],
  };
}

function isLoopbackAddress(address) {
  return address === "::1" || address.startsWith("127.");
}

async function processStart(pid) {
  try {
    const result = execFileSync("ps", ["-o", "lstart=", "-p", String(pid)], {
      encoding: "utf8",
    }).trim();
    return result || null;
  } catch {
    return null;
  }
}

async function processOwnsLease(lease) {
  if (!Number.isInteger(lease?.process?.pid) || typeof lease.process.startedAt !== "string") {
    return false;
  }
  try {
    process.kill(lease.process.pid, 0);
  } catch {
    return false;
  }
  return (await processStart(lease.process.pid)) === lease.process.startedAt;
}

function leasePath(stateDirectory, lease) {
  return path.join(
    stateDirectory,
    LEASES_DIRECTORY,
    `${lease.workspaceIdentity}-${lease.service}-${lease.process.pid}-${encodeURIComponent(lease.process.startedAt)}.json`,
  );
}

async function readLease(file) {
  try {
    const lease = JSON.parse(await readFile(file, "utf8"));
    if (
      lease.version !== LEASE_VERSION ||
      typeof lease.hostname !== "string" ||
      !Number.isInteger(lease.port) ||
      typeof lease.workspaceIdentity !== "string"
    ) {
      return null;
    }
    return { ...lease, service: lease.service ?? "storybook" };
  } catch {
    return null;
  }
}

async function activeLeases(stateDirectory) {
  const directory = path.join(stateDirectory, LEASES_DIRECTORY);
  let entries;
  try {
    entries = await readdir(directory);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  const leases = [];
  for (const entry of entries.filter((name) => name.endsWith(".json"))) {
    const file = path.join(directory, entry);
    const lease = await readLease(file);
    if (lease === null || !(await processOwnsLease(lease))) {
      await rm(file, { force: true });
      continue;
    }
    leases.push(lease);
  }
  return leases;
}

async function caddyConfigurationFromAdmin() {
  try {
    const response = await caddyAdminRequest("/config/");
    return response.ok ? response.json() : null;
  } catch {
    return null;
  }
}

function caddyIsManaged(configuration) {
  const server = managedServer(configuration);
  return (
    server?.listen?.includes(`127.0.0.1:${CADDY_HTTP_PORT}`) &&
    server.routes?.some((route) => route["@id"] === CADDY_ROUTE_MARKER)
  );
}

function caddyIsLegacyManaged(configuration) {
  if (caddyServerHasMarker(configuration, CADDY_SERVER_NAME)) return CADDY_SERVER_NAME;
  return legacyCaddyServerIsLazuli(configuration) ? LEGACY_CADDY_SERVER_NAME : null;
}

function caddyServerHasMarker(configuration, serverName) {
  const server = configuration?.apps?.http?.servers?.[serverName];
  return server?.routes?.some((route) => route["@id"] === CADDY_ROUTE_MARKER) === true;
}

function legacyCaddyServerIsLazuli(configuration) {
  const legacyServer = configuration?.apps?.http?.servers?.[LEGACY_CADDY_SERVER_NAME];
  const routes = legacyServer?.routes;
  if (!Array.isArray(routes) || routes.length === 0) return null;
  return routes.every((route) => legacyRouteBelongsToLazuli(route));
}

function legacyRouteBelongsToLazuli(route) {
  const hosts = route.match?.flatMap((matcher) => matcher.host ?? []) ?? [];
  const upstreams = route.handle?.flatMap((handler) => handler.upstreams ?? []) ?? [];
  const localHosts = hosts.every((host) => host.endsWith(".lazuli.localhost"));
  const localUpstreams = upstreams.every(
    (upstream) => upstream.dial?.startsWith("127.0.0.1:") === true,
  );
  return hosts.length > 0 && upstreams.length > 0 && localHosts && localUpstreams;
}

function managedServer(configuration) {
  const servers = configuration?.apps?.http?.servers;
  return servers?.[CADDY_SERVER_NAME] ?? servers?.[LEGACY_CADDY_SERVER_NAME];
}

function managedServerName(configuration) {
  return configuration?.apps?.http?.servers?.[CADDY_SERVER_NAME] === undefined
    ? LEGACY_CADDY_SERVER_NAME
    : CADDY_SERVER_NAME;
}

function caddyStartError(detail = "") {
  if (/permission denied|operation not permitted|eacces|bind.*permission/iu.test(detail)) {
    return `Caddy could not bind 127.0.0.1:${CADDY_HTTP_PORT} because permission was denied. Lazuli requires its canonical local URLs on port 80; grant Caddy permission to bind that port and retry.`;
  }
  return `Caddy could not start because 127.0.0.1:${CADDY_HTTP_PORT} or its admin port ${CADDY_ADMIN_PORT} is occupied. Free that port and retry.`;
}

async function startCaddy(configurationPath) {
  let child;
  let standardError = "";
  try {
    child = spawn("caddy", ["start", "--config", configurationPath], {
      detached: true,
      stdio: ["ignore", "ignore", "pipe"],
    });
    child.stderr.on("data", (chunk) => {
      standardError += chunk;
    });
  } catch (error) {
    throw new Error(
      `Caddy is required for stable local URLs. Install it with 'brew install caddy': ${error.message}`,
      { cause: error },
    );
  }
  const started = await new Promise((resolve) => {
    child.once("error", (error) => resolve({ error }));
    child.once("exit", (code) => resolve({ code }));
    void wait(CADDY_START_SETTLE_MS).then(() => resolve({}));
  });
  child.unref();
  return { started, standardError };
}

async function caddyBecomesManaged() {
  for (let attempt = 0; attempt < CADDY_START_ATTEMPTS; attempt += 1) {
    const configuration = await caddyConfigurationFromAdmin();
    if (caddyIsManaged(configuration)) return true;
    await wait(CADDY_START_RETRY_MS);
  }
  return false;
}

async function ensureCaddy(stateDirectory) {
  const existingConfiguration = await caddyConfigurationFromAdmin();
  if (existingConfiguration !== null) return await reconcileExistingCaddy(existingConfiguration);
  await startManagedCaddy(stateDirectory);
}

async function reconcileExistingCaddy(configuration) {
  if (caddyIsManaged(configuration)) return;
  const legacyServerName = caddyIsLegacyManaged(configuration);
  if (legacyServerName === null) {
    throw new Error(
      `Caddy's admin API on 127.0.0.1:${CADDY_ADMIN_PORT} belongs to another configuration. Lazuli will not replace it; stop that Caddy instance or configure it separately.`,
    );
  }
  await migrateLegacyCaddy(configuration, legacyServerName);
}

async function migrateLegacyCaddy(configuration, serverName) {
  const server = caddyConfiguration([]).apps.http.servers[CADDY_SERVER_NAME];
  configuration.apps.http.servers[serverName] = server;
  const response = await caddyAdminRequest("/load", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(configuration),
  });
  if (response.ok) return;
  const responseBody = await response.text();
  const detail = responseBody.trim();
  throw new Error(
    `Lazuli's Caddy listener could not migrate to 127.0.0.1:${CADDY_HTTP_PORT} (${response.status}${detail ? `: ${detail}` : ""}). Free port ${CADDY_HTTP_PORT}, ensure Caddy may bind it, and retry.`,
  );
}

async function startManagedCaddy(stateDirectory) {
  const configurationPath = path.join(stateDirectory, CADDY_CONFIG_NAME);
  await writeFile(configurationPath, `${JSON.stringify(caddyConfiguration([]), null, 2)}\n`);
  const { started, standardError } = await startCaddy(configurationPath);
  if (started.error?.code === "ENOENT") {
    throw new Error(
      "Caddy is required for stable local URLs. Install it with 'brew install caddy'.",
    );
  }
  if (started.code !== undefined && started.code !== 0) {
    throw new Error(caddyStartError(standardError));
  }
  if (await caddyBecomesManaged()) return;
  throw new Error(caddyStartError(standardError));
}

async function reloadCaddy(leases) {
  const existingConfiguration = await caddyConfigurationFromAdmin();
  if (!caddyIsManaged(existingConfiguration)) {
    throw new Error(
      "Lazuli's managed Caddy instance is no longer available; refusing to replace its configuration.",
    );
  }
  const routes = leases.map((lease) => routeForLease(lease));
  const server = caddyConfiguration(routes).apps.http.servers[CADDY_SERVER_NAME];
  const serverName = managedServerName(existingConfiguration);
  const response = await caddyAdminRequest(`/config/apps/http/servers/${serverName}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(server),
  });
  if (!response.ok) throw new Error(`Caddy rejected the route configuration (${response.status}).`);
}

async function routeAvailability(lease) {
  if (!caddyIsManaged(await caddyConfigurationFromAdmin())) return "Caddy is not available";
  try {
    const response = await request(`http://127.0.0.1:${CADDY_HTTP_PORT}`, {
      headers: { host: lease.hostname },
    });
    return response.status < HTTP_SERVER_ERROR_START
      ? "available"
      : `unavailable (HTTP ${response.status})`;
  } catch {
    return "unavailable";
  }
}

export async function assertLocalHostname(url) {
  const hostname = new URL(url).hostname;
  try {
    const addresses = await lookup(hostname, { all: true });
    if (addresses.some(({ address }) => isIP(address) !== 0 && isLoopbackAddress(address))) return;
  } catch {
    // The diagnostic below includes resolution failures and non-loopback answers.
  }
  throw new Error(
    `${hostname} does not resolve to this machine. Restore the standard .localhost resolver before starting Storybook.`,
  );
}

export async function registerWorkspaceRoute(root, workspace, service) {
  const url = workspace.urls[service];
  const port = workspace.ports[service];
  if (url === undefined || port === undefined || !["web", "storybook"].includes(service)) {
    throw new Error(`unsupported workspace proxy service: ${service}`);
  }
  await assertLocalHostname(url);
  const stateDirectory = sharedStateDirectory(root);
  await withWorkspaceAllocationLock(root, async () => {
    await mkdir(path.join(stateDirectory, LEASES_DIRECTORY), { recursive: true });
    const lease = {
      version: LEASE_VERSION,
      workspaceIdentity: workspace.identity,
      service,
      hostname: new URL(url).hostname,
      port,
      process: { pid: process.pid, startedAt: await processStart(process.pid) },
    };
    if (lease.process.startedAt === null)
      throw new Error(`could not verify the ${service} process ownership`);
    await ensureCaddy(stateDirectory);
    const file = leasePath(stateDirectory, lease);
    await writeFile(`${file}.${process.pid}.tmp`, `${JSON.stringify(lease, null, 2)}\n`);
    await rename(`${file}.${process.pid}.tmp`, file);
    await reloadCaddy(await activeLeases(stateDirectory));
  });
}

export async function unregisterWorkspaceRoute(root, workspace, service) {
  const stateDirectory = sharedStateDirectory(root);
  await withWorkspaceAllocationLock(root, async () => {
    const processOwnership = { pid: process.pid, startedAt: await processStart(process.pid) };
    if (processOwnership.startedAt === null) return;
    const file = leasePath(stateDirectory, {
      workspaceIdentity: workspace.identity,
      service,
      process: processOwnership,
    });
    const lease = await readLease(file);
    if (
      lease?.workspaceIdentity === workspace.identity &&
      lease.service === service &&
      lease.process?.pid === process.pid &&
      lease.process?.startedAt === (await processStart(process.pid))
    ) {
      await rm(file, { force: true });
    }
    if (caddyIsManaged(await caddyConfigurationFromAdmin())) {
      await reloadCaddy(await activeLeases(stateDirectory));
    }
  });
}

export async function workspaceProxyStatus(root, workspace, service) {
  let stateDirectory;
  try {
    stateDirectory = sharedStateDirectory(root);
  } catch {
    return "not observed (Git is unavailable)";
  }
  const leases = await activeLeases(stateDirectory);
  const lease = leases.find(
    (candidate) =>
      candidate.workspaceIdentity === workspace.identity &&
      candidate.service === service &&
      candidate.hostname === new URL(workspace.urls[service]).hostname &&
      candidate.port === workspace.ports[service],
  );
  const leaseIsLive = lease !== undefined;
  if (!leaseIsLive) return "not registered";
  return `registered to a running ${service} process; route ${await routeAvailability(lease)}`;
}

export const registerStorybookRoute = (root, workspace) =>
  registerWorkspaceRoute(root, workspace, "storybook");
export const unregisterStorybookRoute = (root, workspace) =>
  unregisterWorkspaceRoute(root, workspace, "storybook");
export const storybookProxyStatus = (root, workspace) =>
  workspaceProxyStatus(root, workspace, "storybook");
