import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { it } from "node:test";

import { withWorkspaceAllocationLock } from "../lib/workspace-metadata.mjs";

it(
  "serializes competing abandoned-lock recoveries without deleting the replacement owner",
  { timeout: 10000 },
  async (context) => {
    const root = await fs.mkdtemp(path.join(tmpdir(), "lazuli-lock-race-"));
    context.after(() => fs.rm(root, { recursive: true, force: true }));
    const env = Object.fromEntries(
      Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")),
    );
    execFileSync("git", ["init", "--quiet", root], { env });
    const lock = path.join(root, ".git/lazuli-workspace-allocation.lock");
    await fs.mkdir(lock);
    await fs.writeFile(
      path.join(lock, "owner.json"),
      JSON.stringify({ pid: 0, startedAt: "terminated" }),
    );
    const original = { mkdir: fs.mkdir, rm: fs.rm, readFile: fs.readFile };
    const recovering = Promise.withResolvers();
    const competing = Promise.withResolvers();
    const entered = Promise.withResolvers();
    const release = Promise.withResolvers();
    const observedReplacement = Promise.withResolvers();
    const secondEntered = Promise.withResolvers();
    let removals = 0;
    let recoveryAttempts = 0;
    let firstEntered = false;
    context.mock.method(fs.default, "mkdir", async (...args) => {
      if (args[0] === `${lock}.recovery` && ++recoveryAttempts === 2) competing.resolve();
      return original.mkdir(...args);
    });
    context.mock.method(fs.default, "rm", async (...args) => {
      if (args[0] === lock) {
        removals += 1;
        if (removals === 1) {
          recovering.resolve();
          await competing.promise;
        } else if (removals === 2) {
          competing.resolve();
          await entered.promise;
        }
      }
      return original.rm(...args);
    });
    context.mock.method(fs.default, "readFile", async (...args) => {
      const result = await original.readFile(...args);
      if (args[0] === path.join(lock, "owner.json") && firstEntered)
        observedReplacement.resolve("preserved");
      return result;
    });
    syncBuiltinESMExports();
    context.after(() => {
      context.mock.restoreAll();
      syncBuiltinESMExports();
    });
    const first = withWorkspaceAllocationLock(root, async () => {
      firstEntered = true;
      entered.resolve();
      await release.promise;
    });
    await recovering.promise;
    const second = withWorkspaceAllocationLock(root, () => secondEntered.resolve("overlap"));
    try {
      const outcome = await Promise.race([observedReplacement.promise, secondEntered.promise]);
      assert.equal(outcome, "preserved");
      const owner = JSON.parse(await original.readFile(path.join(lock, "owner.json"), "utf8"));
      assert.equal(owner.pid, process.pid);
    } finally {
      release.resolve();
      await Promise.all([first, second]);
    }
    await assert.rejects(fs.stat(lock), { code: "ENOENT" });
    await assert.rejects(fs.stat(`${lock}.recovery`), { code: "ENOENT" });
  },
);
