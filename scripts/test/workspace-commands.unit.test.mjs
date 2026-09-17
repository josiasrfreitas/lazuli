import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { it } from "node:test";
import { URL, fileURLToPath } from "node:url";

const repositoryRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const setupScript = path.join(repositoryRoot, "scripts/workspace-setup.mjs");
const statusScript = path.join(repositoryRoot, "scripts/workspace-status.mjs");
const teardownScript = path.join(repositoryRoot, "scripts/workspace-teardown.mjs");
const developmentScript = path.join(repositoryRoot, "scripts/development.mjs");
const fixturesScript = path.join(repositoryRoot, "scripts/workspace-fixtures.mjs");
const resetScript = path.join(repositoryRoot, "scripts/workspace-reset.mjs");
const fakeCaddy = path.join(repositoryRoot, "scripts/test/support/fake-caddy.mjs");
const fakeWorkspaceCommand = path.join(
  repositoryRoot,
  "scripts/test/support/fake-workspace-command.mjs",
);
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
    "BETTER_AUTH_SECRET=keep-this-secret\nAPP_URL=http://localhost:3000\nGCS_PROJECT_ID=lazuli-local\nSTORAGE_EMULATOR_HOST=http://localhost:4443\n",
  );
  await writeFile(path.join(directory, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
  await mkdir(path.join(directory, "infra/local/gcs-seed"), { recursive: true });
  await writeFile(path.join(directory, "infra/local/gcs-seed/example.txt"), "expected fixture\n");
  await mkdir(path.join(directory, "bin"));
  for (const command of ["pnpm", "docker", "curl"]) {
    await writeFile(
      path.join(directory, `bin/${command}`),
      `#!/bin/sh\nexec ${process.execPath} ${fakeWorkspaceCommand} ${command} "$@"\n`,
      { mode: 0o755 },
    );
  }
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

function run(directory, script, arguments_ = [], environment = {}) {
  const log = path.join(directory, "pnpm.log");
  return spawnSync(process.execPath, [script, ...arguments_], {
    cwd: directory,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${path.join(directory, "bin")}${path.delimiter}${process.env.PATH}`,
      PNPM_LOG: log,
      ...environment,
    },
  });
}

function requestProxy(hostname, port = 80, address = "127.0.0.1") {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: address, port, headers: { host: hostname } }, (response) => {
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

function runAsync(directory, script, arguments_ = [], environment = {}) {
  const log = path.join(directory, "pnpm.log");
  const child = spawn(process.execPath, [script, ...arguments_], {
    cwd: directory,
    env: {
      ...process.env,
      PATH: `${path.join(directory, "bin")}${path.delimiter}${process.env.PATH}`,
      PNPM_LOG: log,
      ...environment,
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
    env: { ...process.env, PATH: path.join(directory, "bin"), FAKE_DOCKER_UNAVAILABLE: "1" },
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
  assert.equal(workspace.schemaVersion, 2);
  assert.match(workspace.ownershipToken, /^[0-9a-f-]{36}$/u);
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

it("tears down a light workspace without accessing Docker and repeats safely", async (context) => {
  const directory = await fixture(context, "lazuli-light-teardown");
  assert.equal(run(directory, setupScript, ["light"]).status, 0);
  await writeFile(path.join(directory, "infra.log"), "");

  const first = run(directory, teardownScript);
  const second = run(directory, teardownScript);

  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stdout, /teardown complete/u);
  assert.equal(second.status, 0, second.stderr);
  assert.match(second.stdout, /already complete/u);
  assert.equal(await readFile(path.join(directory, "infra.log"), "utf8"), "");
  await assert.rejects(readFile(path.join(directory, ".lazuli/workspace.json"), "utf8"), {
    code: "ENOENT",
  });
});

it("removes only full resources bearing this workspace ownership markers", async (context) => {
  const directory = await fixture(context, "lazuli-full-teardown");
  assert.equal(run(directory, setupScript, ["light"]).status, 0);
  assert.equal(run(directory, setupScript, ["full"]).status, 0);
  await writeFile(path.join(directory, "infra.log"), "");

  const result = run(directory, teardownScript);
  const infraLog = await readFile(path.join(directory, "infra.log"), "utf8");

  assert.equal(result.status, 0, result.stderr);
  assert.match(infraLog, /workspace_ownership/u);
  assert.match(infraLog, /DROP DATABASE/u);
  assert.match(infraLog, /-X DELETE.*storage\/v1\/b/u);
  assert.doesNotMatch(infraLog, /compose (up|down)/u);
  await assert.rejects(readFile(path.join(directory, ".fake-infra/database"), "utf8"), {
    code: "ENOENT",
  });
  await assert.rejects(readFile(path.join(directory, ".fake-infra/bucket"), "utf8"), {
    code: "ENOENT",
  });
});

it("preserves unmarked existing full resources and leaves a resumable journal", async (context) => {
  const directory = await fixture(context, "lazuli-ambiguous-teardown");
  assert.equal(run(directory, setupScript, ["light"]).status, 0);
  await mkdir(path.join(directory, ".fake-infra"), { recursive: true });
  await writeFile(path.join(directory, ".fake-infra/database"), "external\n");
  await writeFile(path.join(directory, ".fake-infra/bucket"), "external\n");
  await writeFile(
    path.join(directory, ".fake-infra/bucket-metadata.json"),
    '{"name":"external"}\n',
  );
  assert.equal(run(directory, setupScript, ["full"]).status, 0);

  const result = run(directory, teardownScript);
  const commonDirectory = execFileSync("git", ["rev-parse", "--git-common-dir"], {
    cwd: directory,
    encoding: "utf8",
  }).trim();
  const journals = await readdir(
    path.resolve(directory, commonDirectory, "lazuli-workspace-orphans"),
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /ownership marker.*preserved/u);
  assert.equal(await readFile(path.join(directory, ".fake-infra/database"), "utf8"), "external\n");
  assert.equal(await readFile(path.join(directory, ".fake-infra/bucket"), "utf8"), "external\n");
  assert.equal(journals.length, 1);
});

it("stops only a process lease whose token, path, PID, and start time still match", async (context) => {
  const directory = await fixture(context, "lazuli-process-teardown");
  assert.equal(run(directory, setupScript, ["light"]).status, 0);
  const workspace = await metadata(directory);
  const stateDirectory = path.join(directory, ".git");
  const leasesDirectory = path.join(stateDirectory, "lazuli-proxy-leases");
  await mkdir(leasesDirectory, { recursive: true });
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
    stdio: "ignore",
  });
  context.after(() => {
    try {
      child.kill("SIGKILL");
    } catch {
      // The teardown is expected to have stopped it already.
    }
  });
  const startedAt = execFileSync("ps", ["-o", "lstart=", "-p", String(child.pid)], {
    encoding: "utf8",
  }).trim();
  const owned = {
    version: 2,
    ownershipToken: workspace.ownershipToken,
    technicalPath: workspace.initialTechnicalPath,
    workspaceIdentity: workspace.identity,
    service: "worker",
    process: { pid: child.pid, startedAt },
  };
  await writeFile(path.join(leasesDirectory, "owned.json"), `${JSON.stringify(owned)}\n`);
  await writeFile(
    path.join(leasesDirectory, "reused.json"),
    `${JSON.stringify({ ...owned, process: { pid: process.pid, startedAt: "reused PID" } })}\n`,
  );
  await writeFile(
    path.join(leasesDirectory, "other.json"),
    `${JSON.stringify({ ...owned, ownershipToken: "other-worktree-token" })}\n`,
  );
  const { teardownWorkspaceLeases } =
    await import("../lib/workspace-proxy.mjs?process-teardown-test");

  const failures = await teardownWorkspaceLeases(directory, workspace, { timeoutMs: 200 });
  if (child.exitCode === null && child.signalCode === null) {
    await new Promise((resolve) => child.once("close", resolve));
  }
  const remaining = await readdir(leasesDirectory);

  assert.deepEqual(failures, ["worker: process identity changed; lease preserved"]);
  assert.deepEqual(remaining.toSorted(), ["other.json", "reused.json"]);
  assert.throws(() => process.kill(child.pid, 0), { code: "ESRCH" });
});

it("releases the lease lock while a wrapper terminates its detached child group", async (context) => {
  const directory = await fixture(context, "lazuli-process-group-teardown");
  assert.equal(run(directory, setupScript, ["light"]).status, 0);
  const workspace = await metadata(directory);
  const stateDirectory = path.join(directory, ".git");
  const leasesDirectory = path.join(stateDirectory, "lazuli-proxy-leases");
  const lockPath = path.join(stateDirectory, "lazuli-workspace-allocation.lock");
  await mkdir(leasesDirectory, { recursive: true });
  const wrapper = spawn(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { setTimeout as wait } from "node:timers/promises";
const lockPath = process.argv[1];
const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { detached: true, stdio: "ignore" });
child.unref();
process.stdout.write(String(child.pid) + "\\n");
process.once("SIGTERM", async () => {
  while (true) {
    try {
      await mkdir(lockPath);
      break;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      await wait(5);
    }
  }
  await rm(lockPath, { force: true, recursive: true });
  process.kill(-child.pid, "SIGTERM");
  process.exit(0);
});
setInterval(() => {}, 1000);`,
      lockPath,
    ],
    { stdio: ["ignore", "pipe", "ignore"] },
  );
  const childPid = Number(await new Promise((resolve) => wrapper.stdout.once("data", resolve)));
  context.after(() => {
    for (const pid of [wrapper.pid, childPid]) {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        // The teardown is expected to have stopped these processes already.
      }
    }
  });
  const startedAt = execFileSync("ps", ["-o", "lstart=", "-p", String(wrapper.pid)], {
    encoding: "utf8",
  }).trim();
  const lease = {
    version: 2,
    ownershipToken: workspace.ownershipToken,
    technicalPath: workspace.initialTechnicalPath,
    workspaceIdentity: workspace.identity,
    service: "worker",
    process: { pid: wrapper.pid, startedAt },
  };
  await writeFile(path.join(leasesDirectory, "wrapper.json"), `${JSON.stringify(lease)}\n`);
  const { teardownWorkspaceLeases } =
    await import("../lib/workspace-proxy.mjs?process-group-teardown-test");
  const wrapperClosed = new Promise((resolve) => wrapper.once("close", resolve));

  const failures = await teardownWorkspaceLeases(directory, workspace, { timeoutMs: 200 });
  await wrapperClosed;

  assert.deepEqual(failures, []);
  assert.throws(() => process.kill(childPid, 0), { code: "ESRCH" });
});

it("rejects Web from a light worktree before invoking Docker", async (context) => {
  const directory = await fixture(context, "lazuli-light-web");
  assert.equal(run(directory, setupScript, ["light"]).status, 0);
  await writeFile(path.join(directory, "infra.log"), "");
  const workspace = await metadata(directory);

  const result = run(directory, developmentScript, ["web"], {
    APP_URL: workspace.urls.web,
    BETTER_AUTH_URL: workspace.urls.web,
    LAZULI_WEB_PORT: String(workspace.ports.web),
  });
  const infraLog = await readFile(path.join(directory, "infra.log"), "utf8");

  assert.equal(result.status, 1);
  assert.match(result.stderr, /pnpm workspace:setup full/u);
  assert.doesNotMatch(infraLog, /compose/u);
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
  assert.equal(await readFile(path.join(directory, "pnpm.log"), "utf8"), "install\n");
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
  assert.match(result.stdout, /Docker is not accessible/u);
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

it("promotes light metadata and initializes each full resource without destructive commands", async (context) => {
  const directory = await fixture(context, "lazuli-full-promotion");
  assert.equal(run(directory, setupScript, ["light"]).status, 0);

  const result = run(directory, setupScript, ["full"]);
  const workspace = await metadata(directory);
  const journal = JSON.parse(
    await readFile(path.join(directory, ".lazuli/database-initialization.json"), "utf8"),
  );
  const pnpmLog = await readFile(path.join(directory, "pnpm.log"), "utf8");
  const infraLog = await readFile(path.join(directory, "infra.log"), "utf8");

  assert.equal(result.status, 0, result.stderr);
  assert.equal(workspace.profile, "full");
  assert.equal(journal.status, "complete");
  assert.match(pnpmLog, /^install\nprisma:deploy\nprisma:seed\n$/u);
  assert.equal(infraLog.match(/^compose up -d$/gmu)?.length, 1);
  assert.match(infraLog, /CREATE SCHEMA IF NOT EXISTS lazuli_local/u);
  assert.doesNotMatch(`${pnpmLog}${infraLog}`, /migrate dev|reset/iu);
  assert.equal(
    await readFile(path.join(directory, ".fake-infra/object-example.txt"), "utf8"),
    "expected fixture\n",
  );
});

it("repeats full setup without reseeding the database or overwriting a GCS object", async (context) => {
  const directory = await fixture(context, "lazuli-full-repeat");
  assert.equal(run(directory, setupScript, ["light"]).status, 0);
  assert.equal(run(directory, setupScript, ["full"]).status, 0);
  await writeFile(path.join(directory, ".fake-infra/object-example.txt"), "local edit\n");

  const result = run(directory, setupScript, ["full"]);
  const pnpmLog = await readFile(path.join(directory, "pnpm.log"), "utf8");
  const infraLog = await readFile(path.join(directory, "infra.log"), "utf8");

  assert.equal(result.status, 0, result.stderr);
  assert.equal(pnpmLog.match(/^prisma:deploy$/gmu)?.length, 2);
  assert.equal(pnpmLog.match(/^prisma:seed$/gmu)?.length, 1);
  assert.equal(infraLog.match(/^compose up -d$/gmu)?.length, 2);
  assert.equal(
    await readFile(path.join(directory, ".fake-infra/object-example.txt"), "utf8"),
    "local edit\n",
  );
});

it("refreshes versioned fixtures without removing additional local data", async (context) => {
  const directory = await fixture(context, "lazuli-fixtures-refresh");
  assert.equal(run(directory, setupScript, ["light"]).status, 0);
  assert.equal(run(directory, setupScript, ["full"]).status, 0);
  await writeFile(path.join(directory, ".fake-infra/object-example.txt"), "local edit\n");
  await writeFile(path.join(directory, ".fake-infra/object-extra.txt"), "extra\n");

  const first = run(directory, fixturesScript, ["refresh"]);
  const second = run(directory, fixturesScript, ["refresh"]);

  assert.equal(first.status, 0, first.stderr);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(
    await readFile(path.join(directory, ".fake-infra/object-example.txt"), "utf8"),
    "expected fixture\n",
  );
  assert.equal(
    await readFile(path.join(directory, ".fake-infra/object-extra.txt"), "utf8"),
    "extra\n",
  );
  assert.match(first.stdout, /Extra records.*may remain/su);
  assert.match(first.stdout, /does not guarantee a clean snapshot/u);
  assert.doesNotMatch(await readFile(path.join(directory, "infra.log"), "utf8"), /DROP DATABASE/u);
});

it("rejects unsupported fixture and reset arguments with usage", async (context) => {
  const directory = await fixture(context, "lazuli-maintenance-usage");

  const missing = run(directory, fixturesScript);
  const wrong = run(directory, fixturesScript, ["replace"]);
  const resetWrong = run(directory, resetScript, ["--force"]);

  assert.deepEqual([missing.status, wrong.status, resetWrong.status], [2, 2, 2]);
  assert.match(missing.stderr, /workspace:fixtures refresh/u);
  assert.match(wrong.stderr, /workspace:fixtures refresh/u);
  assert.match(resetWrong.stderr, /workspace:reset \[--yes\]/u);
});

it("requires --yes without a terminal and resets only the named resources", async (context) => {
  const directory = await fixture(context, "lazuli-workspace-reset");
  assert.equal(run(directory, setupScript, ["light"]).status, 0);
  assert.equal(run(directory, setupScript, ["full"]).status, 0);
  await writeFile(path.join(directory, ".fake-infra/manual-record"), "remove on database reset\n");
  await writeFile(path.join(directory, ".fake-infra/object-extra.txt"), "remove\n");
  await writeFile(path.join(directory, "infra.log"), "");

  const refused = run(directory, resetScript);
  const logBeforeConfirmedReset = await readFile(path.join(directory, "infra.log"), "utf8");
  const reset = run(directory, resetScript, ["--yes"]);
  const journal = JSON.parse(
    await readFile(path.join(directory, ".lazuli/database-initialization.json"), "utf8"),
  );
  const infraLog = await readFile(path.join(directory, "infra.log"), "utf8");

  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /interactive confirmation.*--yes/u);
  assert.doesNotMatch(logBeforeConfirmedReset, /DROP|DELETE/u);
  assert.equal(reset.status, 0, reset.stderr);
  assert.match(reset.stdout, /lazuli_lazuli_workspace_reset/u);
  assert.match(reset.stdout, /lazuli-lazuli-workspace-reset/u);
  assert.equal(journal.status, "complete");
  assert.match(infraLog, /DROP DATABASE IF EXISTS "lazuli_lazuli_workspace_reset"/u);
  assert.doesNotMatch(infraLog, /compose down|compose up/u);
});

it("accepts only the explicit interactive reset confirmation", async () => {
  const { acceptsWorkspaceReset } = await import("../lib/workspace-reset-confirmation.mjs");

  assert.equal(acceptsWorkspaceReset("reset\n"), true);
  assert.equal(acceptsWorkspaceReset("no"), false);
  assert.equal(acceptsWorkspaceReset("yes"), false);
});

it("fails maintenance guards before destructive operations", async (context) => {
  const cases = [
    {
      name: "light profile",
      prepare: async (directory) => {
        assert.equal(run(directory, setupScript, ["light"]).status, 0);
      },
      pattern: /profile must be full/u,
    },
    {
      name: "remote database",
      prepare: async (directory) => {
        assert.equal(run(directory, setupScript, ["light"]).status, 0);
        assert.equal(run(directory, setupScript, ["full"]).status, 0);
        const env = await readFile(path.join(directory, ".env"), "utf8");
        await writeFile(directory + "/.env", env.replace("localhost:5432", "db.example:5432"));
      },
      pattern: /local PostgreSQL/u,
    },
    {
      name: "malformed database URL",
      prepare: async (directory) => {
        assert.equal(run(directory, setupScript, ["light"]).status, 0);
        assert.equal(run(directory, setupScript, ["full"]).status, 0);
        const env = await readFile(path.join(directory, ".env"), "utf8");
        await writeFile(
          directory + "/.env",
          env.replace(/^DATABASE_URL=.*$/mu, "DATABASE_URL=bad"),
        );
      },
      pattern: /valid local PostgreSQL URL/u,
    },
    {
      name: "prefixed database",
      prepare: async (directory) => {
        assert.equal(run(directory, setupScript, ["light"]).status, 0);
        assert.equal(run(directory, setupScript, ["full"]).status, 0);
        const env = await readFile(path.join(directory, ".env"), "utf8");
        await writeFile(
          directory + "/.env",
          env.replace(/\/lazuli_[^?]+/u, "/lazuli_similar_extra"),
        );
      },
      pattern: /does not match workspace metadata/u,
    },
    {
      name: "divergent bucket",
      prepare: async (directory) => {
        assert.equal(run(directory, setupScript, ["light"]).status, 0);
        assert.equal(run(directory, setupScript, ["full"]).status, 0);
        const env = await readFile(path.join(directory, ".env"), "utf8");
        await writeFile(
          directory + "/.env",
          env.replace(/^GCS_ARTIFACTS_BUCKET=.*$/mu, "GCS_ARTIFACTS_BUCKET=lazuli-similar-extra"),
        );
      },
      pattern: /GCS_ARTIFACTS_BUCKET does not match/u,
    },
    {
      name: "shared bucket",
      prepare: async (directory) => {
        assert.equal(run(directory, setupScript, ["light"]).status, 0);
        assert.equal(run(directory, setupScript, ["full"]).status, 0);
        const workspace = await metadata(directory);
        workspace.identity = "main";
        workspace.urls = {
          web: "http://main.lazuli.localhost",
          storybook: "http://storybook.main.lazuli.localhost",
        };
        workspace.resources = { database: "lazuli_main", bucket: "lazuli-main" };
        await writeFile(
          path.join(directory, ".lazuli/workspace.json"),
          `${JSON.stringify(workspace)}\n`,
        );
      },
      pattern: /shared local resource/u,
    },
    {
      name: "wrong Compose labels",
      prepare: async (directory) => {
        assert.equal(run(directory, setupScript, ["light"]).status, 0);
        assert.equal(run(directory, setupScript, ["full"]).status, 0);
      },
      environment: { FAKE_COMPOSE_PROJECT: "other" },
      pattern: /not the expected Lazuli Compose service/u,
    },
  ];

  const observations = [];
  for (const item of cases) {
    const directory = await fixture(context, `lazuli-guard-${item.name.replaceAll(" ", "-")}`);
    await item.prepare(directory);
    await writeFile(path.join(directory, "infra.log"), "");
    const result = run(directory, resetScript, ["--yes"], item.environment);
    observations.push({
      name: item.name,
      status: result.status,
      expectedDiagnostic: item.pattern.test(result.stderr),
      destructiveOperation: /DROP|DELETE/u.test(
        await readFile(path.join(directory, "infra.log"), "utf8"),
      ),
    });
  }
  assert.deepEqual(
    observations,
    cases.map((item) => ({
      name: item.name,
      status: 1,
      expectedDiagnostic: true,
      destructiveOperation: false,
    })),
  );
});

it("revalidates ownership after waiting for the full-workspace lock", async (context) => {
  const directory = await fixture(context, "lazuli-refresh-revalidation");
  assert.equal(run(directory, setupScript, ["light"]).status, 0);
  assert.equal(run(directory, setupScript, ["full"]).status, 0);
  const { withFullSetupLock } = await import("../lib/workspace-full.mjs");
  let release;
  let acquired;
  const locked = new Promise((resolve) => {
    acquired = resolve;
  });
  const blocker = withFullSetupLock(directory, async () => {
    acquired();
    await new Promise((resolve) => {
      release = resolve;
    });
  });
  await locked;
  const refresh = runAsync(directory, fixturesScript, ["refresh"]);
  const env = await readFile(path.join(directory, ".env"), "utf8");
  await writeFile(directory + "/.env", env.replace("localhost:5432", "remote.test:5432"));
  release();

  const result = await refresh;
  await blocker;

  assert.equal(result.status, 1);
  assert.match(result.stderr, /local PostgreSQL/u);
});

it("preserves a preexisting database and only applies migrations", async (context) => {
  const directory = await fixture(context, "lazuli-full-existing-database");
  assert.equal(run(directory, setupScript, ["light"]).status, 0);
  await mkdir(path.join(directory, ".fake-infra"), { recursive: true });
  await writeFile(path.join(directory, ".fake-infra/database"), "existing data\n");

  const result = run(directory, setupScript, ["full"]);
  const pnpmLog = await readFile(path.join(directory, "pnpm.log"), "utf8");

  assert.equal(result.status, 0, result.stderr);
  assert.match(pnpmLog, /prisma:deploy/u);
  assert.doesNotMatch(pnpmLog, /prisma:seed/u);
  await assert.rejects(
    readFile(path.join(directory, ".lazuli/database-initialization.json"), "utf8"),
    { code: "ENOENT" },
  );
});

it("keeps database initialization pending after seed failure and resumes it", async (context) => {
  const directory = await fixture(context, "lazuli-full-seed-resume");
  assert.equal(run(directory, setupScript, ["light"]).status, 0);
  await mkdir(path.join(directory, ".fake-infra"), { recursive: true });
  await writeFile(path.join(directory, ".fake-infra/fail-seed-once"), "armed\n");

  const failed = run(directory, setupScript, ["full"]);
  const pending = JSON.parse(
    await readFile(path.join(directory, ".lazuli/database-initialization.json"), "utf8"),
  );
  const resumed = run(directory, setupScript, ["full"]);
  const complete = JSON.parse(
    await readFile(path.join(directory, ".lazuli/database-initialization.json"), "utf8"),
  );

  assert.equal(failed.status, 1);
  assert.match(failed.stderr, /database initialization.*docker compose ps.*workspace:setup full/su);
  assert.equal(pending.status, "pending");
  assert.equal(resumed.status, 0, resumed.stderr);
  assert.equal(complete.status, "complete");
});

it("does not reseed after fixture initialization commits but journal completion is interrupted", async (context) => {
  const directory = await fixture(context, "lazuli-full-journal-resume");
  assert.equal(run(directory, setupScript, ["light"]).status, 0);

  const interrupted = run(directory, setupScript, ["full"], {
    FAKE_BLOCK_COMPLETION_JOURNAL: "1",
  });
  const journalPath = path.join(directory, ".lazuli/database-initialization.json");
  const seededPath = path.join(directory, ".fake-infra/seeded");

  assert.equal(interrupted.status, 1);
  const seededAfterInterruption = await readFile(seededPath, "utf8");
  assert.equal(seededAfterInterruption.split("\n").filter(Boolean).length, 1);
  await rm(journalPath, { force: true, recursive: true });
  await mkdir(path.dirname(journalPath), { recursive: true });
  await writeFile(
    journalPath,
    `${JSON.stringify({ database: "lazuli_lazuli_full_journal_resume", status: "pending" })}\n`,
  );

  const resumed = run(directory, setupScript, ["full"]);
  const complete = JSON.parse(await readFile(journalPath, "utf8"));

  assert.equal(resumed.status, 0, resumed.stderr);
  const seededAfterResume = await readFile(seededPath, "utf8");
  assert.equal(seededAfterResume.split("\n").filter(Boolean).length, 1);
  assert.equal(complete.status, "complete");
  assert.match(resumed.stdout, /Finalizing completed database initialization/u);
});

it("serializes concurrent full promotions and rereads completed initialization", async (context) => {
  const directory = await fixture(context, "lazuli-full-concurrent");
  assert.equal(run(directory, setupScript, ["light"]).status, 0);

  const results = await Promise.all([
    runAsync(directory, setupScript, ["full"], { FAKE_SEED_DELAY_MS: "250" }),
    runAsync(directory, setupScript, ["full"], { FAKE_SEED_DELAY_MS: "250" }),
  ]);
  const pnpmLog = await readFile(path.join(directory, "pnpm.log"), "utf8");

  assert.deepEqual(
    results.map((result) => result.status),
    [0, 0],
    results.map((result) => result.stderr).join("\n"),
  );
  assert.equal(pnpmLog.match(/^prisma:seed$/gmu)?.length, 1);
  assert.equal(pnpmLog.match(/^prisma:deploy$/gmu)?.length, 2);
});

it("fails an unhealthy declared service with actionable diagnostics", async (context) => {
  const directory = await fixture(context, "lazuli-full-unhealthy");
  assert.equal(run(directory, setupScript, ["light"]).status, 0);

  const result = run(directory, setupScript, ["full"], {
    FAKE_UNHEALTHY_SERVICE: "hatchet-lite",
    LAZULI_COMPOSE_HEALTH_TIMEOUT_MS: "1",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /hatchet-lite is unhealthy/u);
  assert.match(result.stderr, /docker compose logs hatchet-lite/u);
  assert.match(result.stderr, /pnpm workspace:setup full/u);
});

it("fails when a declared Compose service is absent", async (context) => {
  const directory = await fixture(context, "lazuli-full-missing-service");
  assert.equal(run(directory, setupScript, ["light"]).status, 0);

  const result = run(directory, setupScript, ["full"], {
    FAKE_MISSING_SERVICE: "mailpit",
    LAZULI_COMPOSE_HEALTH_TIMEOUT_MS: "1",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /mailpit is absent/u);
  assert.match(result.stderr, /docker compose logs mailpit/u);
});

it("reports observed full resources and incomplete database initialization without starting Compose", async (context) => {
  const directory = await fixture(context, "lazuli-full-status");
  assert.equal(run(directory, setupScript, ["light"]).status, 0);
  assert.equal(run(directory, setupScript, ["full"]).status, 0);
  await writeFile(
    path.join(directory, ".lazuli/database-initialization.json"),
    `${JSON.stringify({ status: "pending" })}\n`,
  );
  await writeFile(path.join(directory, "infra.log"), "");

  const result = run(directory, statusScript);
  const infraLog = await readFile(path.join(directory, "infra.log"), "utf8");

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Profile.*full/u);
  assert.match(result.stdout, /Database.*exists/su);
  assert.match(result.stdout, /Bucket.*exists/su);
  assert.match(result.stdout, /incomplete \(retry setup full\)/u);
  assert.doesNotMatch(infraLog, /compose up/u);
});

it("upgrades the former port-8080 Storybook URL when reading light metadata", async (context) => {
  const directory = await fixture(context, "lazuli-storybook-url-upgrade");
  assert.equal(run(directory, setupScript, ["light"]).status, 0);
  const workspace = await metadata(directory);
  workspace.urls.storybook = `${workspace.urls.storybook}:8080`;
  await writeFile(path.join(directory, ".lazuli/workspace.json"), `${JSON.stringify(workspace)}\n`);

  const { readWorkspaceMetadata } = await import("../lib/workspace-metadata.mjs");
  const upgraded = await readWorkspaceMetadata(directory);

  assert.equal(upgraded.urls.storybook, `http://storybook.${workspace.identity}.lazuli.localhost`);
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
  const { registerStorybookRoute, unregisterStorybookRoute } =
    await import("../lib/workspace-proxy.mjs");
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
  const sourceIpv6Response = await requestProxy(
    new URL(source.urls.storybook).hostname,
    caddyHttpPort,
    "::1",
  );
  const otherResponse = await requestProxy(new URL(other.urls.storybook).hostname, caddyHttpPort);
  const abandonedResponse = await requestProxy(
    "storybook.abandoned.lazuli.localhost",
    caddyHttpPort,
  );
  await unregisterStorybookRoute(directory, source);
  const removedResponse = await requestProxy(
    new URL(source.urls.storybook).hostname,
    caddyHttpPort,
  );
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
  assert.deepEqual(sourceIpv6Response, { status: 200, body: "source storybook" });
  assert.deepEqual(otherResponse, { status: 200, body: "other storybook" });
  assert.deepEqual(configurationAfterReload.apps.http.servers.lazuli_storybook_proxy_v1.listen, [
    `127.0.0.1:${caddyHttpPort}`,
    `[::1]:${caddyHttpPort}`,
  ]);
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
