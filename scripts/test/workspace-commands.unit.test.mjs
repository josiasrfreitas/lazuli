import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { it } from "node:test";
import { URL, fileURLToPath } from "node:url";

const repositoryRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const setupScript = path.join(repositoryRoot, "scripts/workspace-setup.mjs");
const statusScript = path.join(repositoryRoot, "scripts/workspace-status.mjs");
const fakeCaddy = path.join(repositoryRoot, "scripts/test/support/fake-caddy.mjs");
const gitEnvironment = Object.fromEntries(
  Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_")),
);

async function fixture(context, name = "lazuli-feature") {
  const parent = await mkdtemp(path.join(tmpdir(), "lazuli-workspace-"));
  const directory = path.join(parent, name);
  context.after(() => rm(parent, { force: true, recursive: true }));
  await mkdir(directory);
  await writeFile(
    path.join(directory, ".env.example"),
    "BETTER_AUTH_SECRET=keep-this-secret\nAPP_URL=http://localhost:3000\n",
  );
  await mkdir(path.join(directory, "bin"));
  await writeFile(
    path.join(directory, "bin/pnpm"),
    '#!/bin/sh\nprintf "%s\\n" "$*" >> "$PNPM_LOG"\n',
    { mode: 0o755 },
  );
  execFileSync("git", ["init", "--quiet"], { cwd: directory, env: gitEnvironment });
  execFileSync("git", ["config", "user.email", "tests@example.test"], {
    cwd: directory,
    env: gitEnvironment,
  });
  execFileSync("git", ["config", "user.name", "Tests"], { cwd: directory, env: gitEnvironment });
  execFileSync("git", ["add", "."], { cwd: directory, env: gitEnvironment });
  execFileSync("git", ["commit", "--quiet", "-m", "fixture"], {
    cwd: directory,
    env: gitEnvironment,
  });
  return directory;
}

function run(directory, script, arguments_ = []) {
  const log = path.join(directory, "pnpm.log");
  return spawnSync(process.execPath, [script, ...arguments_], {
    cwd: directory,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${path.join(directory, "bin")}${path.delimiter}${process.env.PATH}`,
      PNPM_LOG: log,
    },
  });
}

function requestProxy(hostname, port = 80) {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: "127.0.0.1", port, headers: { host: hostname } }, (response) => {
      let body = "";
      response.on("data", (chunk) => (body += chunk));
      response.on("end", () => resolve({ status: response.statusCode, body }));
    });
    request.once("error", reject);
  });
}

function caddyRequest(port, pathname, options = {}) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        host: "127.0.0.1",
        port,
        path: pathname,
        method: options.method ?? "GET",
        headers: { origin: `http://127.0.0.1:${port}`, ...options.headers },
      },
      (response) => {
        let body = "";
        response.on("data", (chunk) => (body += chunk));
        response.on("end", () => resolve({ status: response.statusCode, body }));
      },
    );
    request.once("error", reject);
    request.end(options.body);
  });
}

async function startUpstream(body) {
  const server = http.createServer((_request, response) => response.end(body));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return server;
}

function runAsync(directory, script, arguments_ = []) {
  const log = path.join(directory, "pnpm.log");
  const child = spawn(process.execPath, [script, ...arguments_], {
    cwd: directory,
    env: {
      ...process.env,
      PATH: `${path.join(directory, "bin")}${path.delimiter}${process.env.PATH}`,
      PNPM_LOG: log,
    },
  });
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}

function statusWithoutDocker(directory) {
  return spawnSync(process.execPath, [statusScript], {
    cwd: directory,
    encoding: "utf8",
    env: { ...process.env, PATH: path.join(directory, "bin") },
  });
}

async function metadata(directory) {
  return JSON.parse(await readFile(path.join(directory, ".lazuli/workspace.json"), "utf8"));
}

it("sets up a light worktree without infrastructure and persists only stable intent", async (context) => {
  const directory = await fixture(context, "Lazuli Feature___One");
  await writeFile(
    path.join(directory, ".env"),
    'BETTER_AUTH_SECRET=keep-this-secret\nDATABASE_URL="postgresql://local-user:local-password@db.test:5433/old?sslmode=require"\n',
  );

  const result = run(directory, setupScript, ["light"]);
  const workspace = await metadata(directory);
  const env = await readFile(path.join(directory, ".env"), "utf8");

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(workspace.profile, "light");
  assert.equal(workspace.identity, "lazuli-feature-one");
  assert.equal(workspace.resources.database, "lazuli_lazuli_feature_one");
  assert.equal(workspace.resources.bucket, "lazuli-lazuli-feature-one");
  assert.match(workspace.urls.web, /^http:\/\/lazuli-feature-one\.lazuli\.localhost$/u);
  assert.notEqual(workspace.ports.web, workspace.ports.storybook);
  assert.match(env, /BETTER_AUTH_SECRET=keep-this-secret/u);
  assert.match(
    env,
    /DATABASE_URL=postgresql:\/\/local-user:local-password@db\.test:5433\/lazuli_lazuli_feature_one\?sslmode=require/u,
  );
  assert.match(env, new RegExp(`APP_URL=${workspace.urls.web}`));
  assert.match(env, new RegExp(`LAZULI_WEB_PORT=${workspace.ports.web}`));
  assert.equal(await readFile(path.join(directory, "pnpm.log"), "utf8"), "install\n");
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /docker|prisma|seed/iu);
});

it("keeps metadata and secrets across a branch change while installing again", async (context) => {
  const directory = await fixture(context);
  assert.equal(run(directory, setupScript, ["light"]).status, 0);
  const before = await metadata(directory);
  await writeFile(path.join(directory, ".env"), "BETTER_AUTH_SECRET=retained\n", { flag: "a" });
  execFileSync("git", ["checkout", "--quiet", "-b", "renamed-branch"], {
    cwd: directory,
    env: gitEnvironment,
  });

  const result = run(directory, setupScript, ["light"]);
  const after = await metadata(directory);

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(after, before);
  assert.match(
    await readFile(path.join(directory, ".env"), "utf8"),
    /BETTER_AUTH_SECRET=retained/u,
  );
  assert.equal(await readFile(path.join(directory, "pnpm.log"), "utf8"), "install\ninstall\n");
});

it("rejects an identity that normalizes to an existing registered worktree", async (context) => {
  const directory = await fixture(context, "lazuli-identity-source");
  assert.equal(run(directory, setupScript, ["light"]).status, 0);
  const sibling = path.join(path.dirname(directory), "lazuli identity source");
  execFileSync("git", ["worktree", "add", "--quiet", "-b", "sibling", sibling], {
    cwd: directory,
    env: gitEnvironment,
  });
  await writeFile(path.join(sibling, "bin/pnpm"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });

  const result = run(sibling, setupScript, ["light"]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /identity.*already belongs/u);
});

it("uses distinct persisted ports across registered worktrees", async (context) => {
  const directory = await fixture(context, "lazuli-port-source");
  assert.equal(run(directory, setupScript, ["light"]).status, 0);
  const sibling = path.join(path.dirname(directory), "lazuli-port-sibling");
  execFileSync("git", ["worktree", "add", "--quiet", "-b", "port-sibling", sibling], {
    cwd: directory,
    env: gitEnvironment,
  });

  const result = run(sibling, setupScript, ["light"]);
  const sourceWorkspace = await metadata(directory);
  const siblingWorkspace = await metadata(sibling);

  assert.equal(result.status, 0, result.stderr);
  assert.notEqual(siblingWorkspace.ports.web, sourceWorkspace.ports.web);
  assert.notEqual(siblingWorkspace.ports.storybook, sourceWorkspace.ports.storybook);
});

it("serializes identity and port allocation across linked worktrees", async (context) => {
  const directory = await fixture(context, "lazuli-lock-source");
  const sibling = path.join(path.dirname(directory), "lazuli-lock-sibling");
  execFileSync("git", ["worktree", "add", "--quiet", "-b", "lock-sibling", sibling], {
    cwd: directory,
    env: gitEnvironment,
  });

  const [sourceResult, siblingResult] = await Promise.all(
    [directory, sibling].map((worktree) => runAsync(worktree, setupScript, ["light"])),
  );
  const sourceWorkspace = await metadata(directory);
  const siblingWorkspace = await metadata(sibling);

  assert.equal(sourceResult.status, 0, sourceResult.stderr);
  assert.equal(siblingResult.status, 0, siblingResult.stderr);
  assert.notEqual(sourceWorkspace.ports.web, siblingWorkspace.ports.web);
  assert.notEqual(sourceWorkspace.ports.storybook, siblingWorkspace.ports.storybook);
});

it("reports light configuration without requiring Docker and ignores the legacy marker", async (context) => {
  const directory = await fixture(context);
  assert.equal(run(directory, setupScript, ["light"]).status, 0);
  await writeFile(path.join(directory, ".worktree-bootstrapped"), "legacy\n");

  const result = statusWithoutDocker(directory);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^Workspace status\n/mu);
  assert.match(result.stdout, /┌.*┐\n│ Workspace\s+│ Value/mu);
  assert.match(result.stdout, /Profile.*light/u);
  assert.match(result.stdout, /Web URL.*http:/u);
  assert.match(result.stdout, /Database.*lazuli_/u);
  assert.match(result.stdout, /Not provisioned by the light profile/u);
  assert.match(result.stdout, /Docker is unavailable/u);
  assert.doesNotMatch(result.stdout, /Perfil|não provisionado|indisponível/u);
  assert.doesNotMatch(result.stdout, /worktree-bootstrapped/u);
});

it("reports a service state when Docker omits its health value", async (context) => {
  const directory = await fixture(context, "lazuli-status-docker");
  assert.equal(run(directory, setupScript, ["light"]).status, 0);
  await writeFile(
    path.join(directory, "bin/docker"),
    '#!/bin/sh\nprintf \'%s\\n\' \'{"Service":"mailpit","Health":"","State":"running"}\'\n',
    { mode: 0o755 },
  );

  const result = statusWithoutDocker(directory);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /mailpit: running/u);
});

it("upgrades the former port-80 Storybook URL when reading light metadata", async (context) => {
  const directory = await fixture(context, "lazuli-storybook-url-upgrade");
  assert.equal(run(directory, setupScript, ["light"]).status, 0);
  const workspace = await metadata(directory);
  workspace.urls.storybook = workspace.urls.storybook.replace(":8080", "");
  await writeFile(path.join(directory, ".lazuli/workspace.json"), `${JSON.stringify(workspace)}\n`);

  const { readWorkspaceMetadata } = await import("../lib/workspace-metadata.mjs");
  const upgraded = await readWorkspaceMetadata(directory);

  assert.equal(upgraded.urls.storybook, `http://storybook.${workspace.identity}.lazuli.localhost:8080`);
});

it("routes two live Storybook leases by their stable hostnames and removes its own lease", async (context) => {
  const directory = await fixture(context, "lazuli-proxy-source");
  const sibling = path.join(path.dirname(directory), "lazuli-proxy-sibling");
  execFileSync("git", ["worktree", "add", "--quiet", "-b", "proxy-sibling", sibling], {
    cwd: directory,
    env: gitEnvironment,
  });
  assert.equal(run(directory, setupScript, ["light"]).status, 0);
  assert.equal(run(sibling, setupScript, ["light"]).status, 0);
  const source = await metadata(directory);
  const other = await metadata(sibling);
  const sourceServer = await startUpstream("source storybook");
  const otherServer = await startUpstream("other storybook");
  context.after(() => sourceServer.close());
  context.after(() => otherServer.close());
  source.ports.storybook = sourceServer.address().port;
  other.ports.storybook = otherServer.address().port;
  const stateDirectory = path.join(path.dirname(directory), "proxy-state");
  const originalPath = process.env.PATH;
  const originalCaddyAdminPort = process.env.LAZULI_CADDY_ADMIN_PORT;
  const originalCaddyHttpPort = process.env.LAZULI_CADDY_HTTP_PORT;
  const caddyAdminPort = 12_019;
  const caddyHttpPort = 18_080;
  process.env.LAZULI_PROXY_STATE_DIR = stateDirectory;
  process.env.PATH = `${path.join(directory, "bin")}${path.delimiter}${originalPath}`;
  process.env.LAZULI_CADDY_ADMIN_PORT = String(caddyAdminPort);
  process.env.LAZULI_CADDY_HTTP_PORT = String(caddyHttpPort);
  await writeFile(
    path.join(directory, "bin/caddy"),
    `#!/bin/sh\nexec ${process.execPath} ${fakeCaddy} "$@"\n`,
    { mode: 0o755 },
  );
  await mkdir(path.join(stateDirectory, "lazuli-proxy-leases"), { recursive: true });
  await writeFile(
    path.join(stateDirectory, "lazuli-proxy-leases", "abandoned-storybook.json"),
    JSON.stringify({
      version: 1,
      workspaceIdentity: "abandoned",
      hostname: "storybook.abandoned.lazuli.localhost",
      port: source.ports.storybook,
      process: { pid: 999_999, startedAt: "Thu Jan  1 00:00:00 1970" },
    }),
  );
  const { registerStorybookRoute, unregisterStorybookRoute } = await import("../lib/workspace-proxy.mjs");
  await registerStorybookRoute(directory, source);
  const unrelatedServer = {
    listen: ["127.0.0.1:18_081"],
    routes: [],
  };
  await caddyRequest(caddyAdminPort, "/config/apps/http/servers/unrelated", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(unrelatedServer),
  });
  await registerStorybookRoute(sibling, other);
  const reloadedCaddy = await caddyRequest(caddyAdminPort, "/config/");
  const configurationAfterReload = JSON.parse(reloadedCaddy.body);
  const sourceResponse = await requestProxy(new URL(source.urls.storybook).hostname, caddyHttpPort);
  const otherResponse = await requestProxy(new URL(other.urls.storybook).hostname, caddyHttpPort);
  const abandonedResponse = await requestProxy("storybook.abandoned.lazuli.localhost", caddyHttpPort);
  await unregisterStorybookRoute(directory, source);
  const removedResponse = await requestProxy(new URL(source.urls.storybook).hostname, caddyHttpPort);
  await unregisterStorybookRoute(sibling, other);
  try {
    const caddyPid = Number(await readFile(path.join(stateDirectory, "fake-caddy.pid"), "utf8"));
    process.kill(caddyPid, "SIGTERM");
  } catch {
    // A real Caddy was already available, so the fixture did not start one.
  }
  process.env.LAZULI_PROXY_STATE_DIR = undefined;
  process.env.PATH = originalPath;
  process.env.LAZULI_CADDY_ADMIN_PORT = originalCaddyAdminPort;
  process.env.LAZULI_CADDY_HTTP_PORT = originalCaddyHttpPort;

  assert.deepEqual(sourceResponse, { status: 200, body: "source storybook" });
  assert.deepEqual(otherResponse, { status: 200, body: "other storybook" });
  assert.equal(abandonedResponse.status, 404);
  assert.equal(removedResponse.status, 404);
  assert.deepEqual(configurationAfterReload.apps.http.servers.unrelated, unrelatedServer);
});

it("fails status for missing or invalid metadata without writing it", async (context) => {
  const missing = await fixture(context, "lazuli-status-missing");
  const missingResult = run(missing, statusScript);
  assert.equal(missingResult.status, 1);
  assert.match(missingResult.stderr, /workspace:setup light/u);

  const invalid = await fixture(context, "lazuli-status-invalid");
  await mkdir(path.join(invalid, ".lazuli"));
  await writeFile(path.join(invalid, ".lazuli/workspace.json"), "{invalid\n");
  const invalidResult = run(invalid, statusScript);
  assert.equal(invalidResult.status, 1);
  assert.match(invalidResult.stderr, /invalid/i);
});

it("runs light setup from the new-worktree hook", async (context) => {
  const directory = await fixture(context, "lazuli-hook");
  const linked = path.join(path.dirname(directory), "lazuli-hook-linked");
  execFileSync("git", ["worktree", "add", "--quiet", "-b", "hook-linked", linked], {
    cwd: directory,
    env: gitEnvironment,
  });
  await cp(path.join(repositoryRoot, "scripts"), path.join(linked, "scripts"), {
    recursive: true,
  });
  const result = spawnSync(
    "bash",
    [path.join(linked, "scripts/git-hooks/post-checkout-worktree.sh"), "0".repeat(40), "HEAD", "1"],
    {
      cwd: linked,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${path.join(linked, "bin")}${path.delimiter}${process.env.PATH}`,
        PNPM_LOG: path.join(linked, "pnpm.log"),
      },
    },
  );

  assert.equal(result.status, 0, result.stderr);
  const linkedMetadata = await metadata(linked);
  assert.equal(linkedMetadata.profile, "light");
});

it("keeps the legacy bootstrap from taking ownership of light metadata", async (context) => {
  const directory = await fixture(context, "lazuli-bootstrap-protection");
  await cp(path.join(repositoryRoot, "scripts"), path.join(directory, "scripts"), {
    recursive: true,
  });
  await mkdir(path.join(directory, ".lazuli"));
  await writeFile(path.join(directory, ".lazuli/workspace.json"), "{}\n");
  const result = spawnSync("bash", [path.join(directory, "scripts/bootstrap-worktree.sh")], {
    cwd: directory,
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /workspace:setup light/u);
});

it("does not allocate a port with an active local listener", async (context) => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  context.after(() => server.close());
  const { findAvailablePort } = await import("../lib/workspace-metadata.mjs");

  const port = await findAvailablePort({ start: address.port, end: address.port + 1 }, new Set());

  assert.equal(port, address.port + 1);
});

it("normalizes technical directory names and rejects identities longer than 56 characters", async (context) => {
  const { normalizeWorkspaceIdentity } = await import("../lib/workspace-metadata.mjs");
  assert.equal(normalizeWorkspaceIdentity("Feature___Árvore!"), "feature-rvore");

  const directory = await fixture(context, "a".repeat(57));
  const result = run(directory, setupScript, ["light"]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /exceeds 56 characters/u);
});
