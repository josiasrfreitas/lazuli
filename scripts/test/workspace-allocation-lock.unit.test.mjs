import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import * as fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { it } from "node:test";
import { setImmediate as nextTurn } from "node:timers/promises";
import { URL } from "node:url";

import { withWorkspaceAllocationLock } from "../lib/workspace-metadata.mjs";

async function fixture(context) {
  const root = await fs.mkdtemp(path.join(tmpdir(), "lazuli-lock-race-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")),
  );
  execFileSync("git", ["init", "--quiet", root], { env });
  const directory = path.join(root, ".git/lazuli-workspace-allocation.lock.queue");
  await fs.mkdir(directory);
  return { root, directory };
}

it(
  "serializes competing abandoned-lock recoveries without deleting the replacement owner",
  { timeout: 10000 },
  async (context) => {
    const { root, directory } = await fixture(context);
    await fs.writeFile(
      path.join(directory, "dead.json"),
      JSON.stringify({ pid: 0, startedAt: "terminated", ticket: 1, choosing: true }),
    );
    const original = { rename: fs.rename, readFile: fs.readFile };
    const intents = Promise.withResolvers();
    let published = 0;
    let active = 0;
    let peak = 0;
    const visits = [];
    context.mock.method(fs.default, "rename", async (...args) => {
      const result = await original.rename(...args);
      const owner = JSON.parse(await original.readFile(args[1], "utf8"));
      if (owner.choosing) {
        published += 1;
        if (published === 2) intents.resolve();
        await intents.promise;
      }
      return result;
    });
    syncBuiltinESMExports();
    context.after(() => {
      context.mock.restoreAll();
      syncBuiltinESMExports();
    });
    await Promise.all(
      [0, 1].map((id) =>
        withWorkspaceAllocationLock(root, async () => {
          active += 1;
          peak = Math.max(peak, active);
          visits.push(id);
          await nextTurn();
          active -= 1;
        }),
      ),
    );
    assert.equal(peak, 1);
    assert.deepEqual(visits.toSorted(), [0, 1]);
    assert.deepEqual(await fs.readdir(directory), []);
  },
);

it(
  "recovers when a contender is killed while choosing its ticket",
  { timeout: 10000 },
  async (context) => {
    const { root, directory } = await fixture(context);
    // Freeze the real acquisition just after publishing its intent, before it
    // chooses a ticket. This is the termination window of a recovery attempt.
    const moduleUrl = new URL("../lib/workspace-metadata.mjs", import.meta.url).href;
    const child = spawn(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `
    import fs from "node:fs/promises";
    import { syncBuiltinESMExports } from "node:module";
    const rename = fs.rename;
    fs.rename = async (...args) => {
      await rename(...args);
      process.stdout.write("choosing\\n");
      await new Promise(() => {});
    };
    syncBuiltinESMExports();
    process.stdin.resume();
    const { withWorkspaceAllocationLock } = await import(${JSON.stringify(moduleUrl)});
    await withWorkspaceAllocationLock(process.cwd(), () => { throw new Error("must not enter"); });
  `,
      ],
      { cwd: root, stdio: ["pipe", "pipe", "pipe"] },
    );
    context.after(() => child.kill("SIGKILL"));
    await new Promise((resolve, reject) => {
      child.stdout.once("data", resolve);
      child.once("error", reject);
      child.once("exit", (code) => reject(new Error(`contender exited early: ${code}`)));
    });
    const [name] = await fs.readdir(directory);
    const abandoned = JSON.parse(await fs.readFile(path.join(directory, name), "utf8"));
    assert.equal(abandoned.choosing, true);
    child.kill("SIGKILL");
    await new Promise((resolve) => child.once("close", resolve));
    let visits = 0;
    await withWorkspaceAllocationLock(root, () => {
      visits += 1;
    });
    assert.equal(visits, 1);
    assert.deepEqual(await fs.readdir(directory), []);
  },
);
