import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { it } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function write(directory, file, source) {
  const target = path.join(directory, file);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, source);
}

const env = Object.fromEntries(
  Object.entries(process.env).filter(
    ([name]) => !name.startsWith("GIT_") && !name.startsWith("TURBO_"),
  ),
);

async function configureFixture(directory) {
  const manifest = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  await write(
    directory,
    "package.json",
    JSON.stringify({
      name: "root-check-fixture",
      private: true,
      type: "module",
      packageManager: manifest.packageManager,
      scripts: { "test:component-lines": manifest.scripts["test:component-lines"] },
    }),
  );
  await write(directory, "turbo.json", await readFile(path.join(root, "turbo.json"), "utf8"));
  await write(directory, "pnpm-workspace.yaml", "packages:\n  - 'packages/*'\n");
  await write(directory, "packages/ui/package.json", '{"name":"@fixture/ui","private":true}\n');
  await write(directory, ".gitignore", "node_modules/\n.turbo/\n");
  await write(
    directory,
    "scripts/test-component-lines.mjs",
    await readFile(path.join(root, "scripts/test-component-lines.mjs"), "utf8"),
  );
  await write(directory, "packages/ui/src/components/button.tsx", "export {};\n");
  await write(directory, "apps/web/src/page.tsx", "export {};\n");
  execFileSync("pnpm", ["install", "--offline", "--ignore-scripts"], {
    cwd: directory,
    env,
    stdio: "ignore",
  });
  execFileSync("git", ["init", "--quiet"], { cwd: directory, env });
  execFileSync("git", ["add", "."], { cwd: directory, env });
}

it("reuses a root check then rejects a workspace regression instead of replaying the cached pass", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "lazuli-root-cache-"));
  context.after(() => rm(directory, { force: true, recursive: true }));
  await configureFixture(directory);
  const run = () =>
    spawnSync(path.join(root, "node_modules/.bin/turbo"), ["run", "test:component-lines"], {
      cwd: directory,
      env,
      encoding: "utf8",
    });

  const first = run();
  assert.equal(first.status, 0, first.stderr);
  const reused = run();
  assert.equal(reused.status, 0, reused.stderr);
  assert.match(reused.stdout, /cache hit/u);
  await write(directory, "apps/web/src/page.tsx", "// line\n".repeat(201));
  const regression = run();
  assert.notEqual(regression.status, 0);
  assert.match(regression.stdout + regression.stderr, /component files are limited to 200/u);
});
