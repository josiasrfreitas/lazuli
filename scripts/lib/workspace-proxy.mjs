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
          lazuli: {
            listen: [`:${CADDY_HTTP_PORT}`],
            routes,
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

function leasePath(stateDirectory, identity) {
  return path.join(stateDirectory, LEASES_DIRECTORY, `${identity}-storybook.json`);
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
    return lease;
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

async function caddyIsManaged() {
  try {
    const response = await caddyAdminRequest("/config/apps/http/servers/lazuli");
    return response.ok;
  } catch {
    return false;
  }
}

async function ensureCaddy(stateDirectory) {
  if (await caddyIsManaged()) return;
  const configurationPath = path.join(stateDirectory, CADDY_CONFIG_NAME);
  await writeFile(configurationPath, `${JSON.stringify(caddyConfiguration([]), null, 2)}\n`);
  let child;
  try {
    child = spawn("caddy", ["start", "--config", configurationPath], {
      detached: true,
      stdio: "ignore",
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
  if (started.error?.code === "ENOENT") {
    throw new Error("Caddy is required for stable local URLs. Install it with 'brew install caddy'.");
  }
  if (started.code !== undefined && started.code !== 0) {
    throw new Error("Caddy could not start. Port 80 may already be in use; free port 80 and retry.");
  }
  for (let attempt = 0; attempt < CADDY_START_ATTEMPTS; attempt += 1) {
    if (await caddyIsManaged()) return;
    await wait(CADDY_START_RETRY_MS);
  }
  throw new Error(
    "Caddy did not become available on its local admin API. Port 80 may already be in use; free port 80 and retry.",
  );
}

async function reloadCaddy(stateDirectory, leases) {
  const response = await caddyAdminRequest("/load", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(caddyConfiguration(leases.map((lease) => routeForLease(lease)))),
  });
  if (!response.ok) throw new Error(`Caddy rejected the route configuration (${response.status}).`);
}

async function routeAvailability(lease) {
  if (!(await caddyIsManaged())) return "Caddy is not available";
  try {
    const response = await request(`http://127.0.0.1:${CADDY_HTTP_PORT}`, {
      headers: { host: lease.hostname },
    });
    return response.status < HTTP_SERVER_ERROR_START ? "available" : `unavailable (HTTP ${response.status})`;
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

export async function registerStorybookRoute(root, workspace) {
  await assertLocalHostname(workspace.urls.storybook);
  const stateDirectory = sharedStateDirectory(root);
  await withWorkspaceAllocationLock(root, async () => {
    await mkdir(path.join(stateDirectory, LEASES_DIRECTORY), { recursive: true });
    const lease = {
      version: LEASE_VERSION,
      workspaceIdentity: workspace.identity,
      hostname: new URL(workspace.urls.storybook).hostname,
      port: workspace.ports.storybook,
      process: { pid: process.pid, startedAt: await processStart(process.pid) },
    };
    if (lease.process.startedAt === null) throw new Error("could not verify the Storybook process ownership");
    await ensureCaddy(stateDirectory);
    const file = leasePath(stateDirectory, workspace.identity);
    await writeFile(`${file}.${process.pid}.tmp`, `${JSON.stringify(lease, null, 2)}\n`);
    await rename(`${file}.${process.pid}.tmp`, file);
    await reloadCaddy(stateDirectory, await activeLeases(stateDirectory));
  });
}

export async function unregisterStorybookRoute(root, workspace) {
  const stateDirectory = sharedStateDirectory(root);
  await withWorkspaceAllocationLock(root, async () => {
    const file = leasePath(stateDirectory, workspace.identity);
    const lease = await readLease(file);
    if (
      lease?.workspaceIdentity === workspace.identity &&
      lease.process?.pid === process.pid &&
      lease.process?.startedAt === (await processStart(process.pid))
    ) {
      await rm(file, { force: true });
    }
    if (await caddyIsManaged()) await reloadCaddy(stateDirectory, await activeLeases(stateDirectory));
  });
}

export async function storybookProxyStatus(root, workspace) {
  let stateDirectory;
  try {
    stateDirectory = sharedStateDirectory(root);
  } catch {
    return "not observed (Git is unavailable)";
  }
  const lease = await readLease(leasePath(stateDirectory, workspace.identity));
  const leaseIsLive =
    lease?.hostname === new URL(workspace.urls.storybook).hostname &&
    lease.port === workspace.ports.storybook &&
    (await processOwnsLease(lease));
  if (!leaseIsLive) return "not registered";
  return `registered to a running Storybook process; route ${await routeAvailability(lease)}`;
}
