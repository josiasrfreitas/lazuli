import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

const script = path.resolve(".codex/skills/vibe-police/scripts/check_pr_size.py");

function repository(testContext) {
  const root = mkdtempSync(path.join(tmpdir(), "vibe-police-"));
  testContext.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => {
    const result = spawnSync("git", ["-C", root, ...args], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  const write = (file, content) => {
    const target = path.join(root, file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content);
  };
  const commit = () => {
    git("add", ".");
    git("-c", "core.hooksPath=/dev/null", "commit", "--no-gpg-sign", "-m", "fixture");
    return git("rev-parse", "HEAD");
  };
  const measure = (base = "main") => {
    const result = spawnSync("python3", [script, "--base", base], {
      cwd: root,
      encoding: "utf8",
    });
    return { status: result.status, report: JSON.parse(result.stdout || result.stderr) };
  };
  git("init", "-b", "main");
  git("config", "user.name", "Test");
  git("config", "user.email", "test@example.com");
  return { git, write, commit, measure };
}

function lines(count, prefix = "new") {
  return Array.from({ length: count }, (_value, index) => `${prefix} ${index}\n`).join("");
}

test("uses the PR merge-base and reports product and tests without enforcing former line limits", (testContext) => {
  const repo = repository(testContext);
  repo.write("apps/web/src/flow.ts", lines(10, "old"));
  const ancestor = repo.commit();
  repo.git("branch", "slice");
  repo.write("unrelated.md", lines(900));
  repo.commit();
  repo.git("checkout", "slice");
  repo.write("apps/web/src/flow.ts", lines(1989));
  repo.write("packages/api/test/flow.integration.test.ts", lines(1000));
  repo.write("packages/api/test/support/data.json", lines(1000));
  repo.commit();

  const belowMinimum = repo.measure();
  assert.equal(belowMinimum.status, 0);
  assert.equal(belowMinimum.report.passed, true);
  assert.equal(belowMinimum.report.feature_lines, 1999);
  assert.equal(belowMinimum.report.test_lines, 2000);

  repo.write("apps/web/src/flow.ts", lines(1990));
  repo.commit();

  const atLimit = repo.measure();
  assert.equal(atLimit.status, 0);
  assert.equal(atLimit.report.merge_base, ancestor);
  assert.equal(atLimit.report.feature_lines, 2000);
  assert.equal(atLimit.report.test_lines, 2000);
  assert.equal(atLimit.report.minimum, null);
  assert.equal(atLimit.report.limit, null);

  repo.write("apps/web/src/flow.ts", lines(1991));
  repo.commit();
  const insideRange = repo.measure();
  assert.equal(insideRange.status, 0);
  assert.equal(insideRange.report.passed, true);
  assert.equal(insideRange.report.feature_lines, 2001);

  repo.write("apps/web/src/flow.ts", lines(9990));
  repo.commit();
  const atCeiling = repo.measure();
  assert.equal(atCeiling.status, 0);
  assert.equal(atCeiling.report.feature_lines, 10000);
  assert.equal(atCeiling.report.test_lines, 2000);

  repo.write("apps/web/src/flow.ts", lines(9991));
  repo.commit();
  const overLimit = repo.measure();
  assert.equal(overLimit.status, 0);
  assert.equal(overLimit.report.passed, true);
  assert.equal(overLimit.report.feature_lines, 10001);
});

test("moving production into tests still counts its removal and does not hide other files", (testContext) => {
  const repo = repository(testContext);
  repo.write("packages/domain/src/flow.ts", lines(10001));
  repo.commit();
  repo.git("checkout", "-b", "slice");
  repo.write("packages/domain/test/.keep", "");
  repo.git("mv", "packages/domain/src/flow.ts", "packages/domain/test/flow.test.ts");
  repo.write("docs/specification.md", "contract\n");
  repo.write("pnpm-lock.yaml", "version\n");
  repo.write("packages/db/prisma/migrations/example/migration.sql", "schema\n");
  repo.write("a\tstrange\nfilename.txt", "content\n");
  repo.commit();

  const result = repo.measure();
  assert.equal(result.status, 0);
  assert.equal(result.report.feature_lines, 10004);
  assert.equal(result.report.test_lines, 10001);
  assert.equal(result.report.documentation_lines, 1);
});

test("excludes documentation and scripts separately while retaining config, migrations and product code", (testContext) => {
  const repo = repository(testContext);
  repo.write("base.md", "base\n");
  repo.commit();
  repo.git("checkout", "-b", "slice");
  repo.write("apps/web/src/flow.ts", lines(2000));
  repo.write("docs/specification.md", lines(6000));
  repo.write("packages/api/README.md", lines(5000));
  repo.write("apps/storybook/src/forms.stories.tsx", lines(1000));
  repo.write("docs/diagram.png", Buffer.from([0, 1, 2]));
  repo.write("scripts/bootstrap.mjs", lines(7000));
  repo.write("packages/db/scripts/import.ts", lines(5000));
  repo.write("bootstrap.sh", lines(3000));
  repo.write("packages/db/src/seed-dev.ts", lines(4000));
  repo.write("scripts/test/bootstrap.unit.test.mjs", lines(1000));
  repo.write("pnpm-lock.yaml", "lock\n");
  repo.write("packages/db/prisma/migrations/new/migration.sql", "schema\n");
  repo.write("apps/web/src/script-editor.ts", "product\n");
  repo.commit();
  const result = repo.measure();
  assert.equal(result.status, 0);
  assert.equal(result.report.feature_lines, 2003);
  assert.equal(result.report.test_lines, 1000);
  assert.equal(result.report.documentation_lines, 12000);
  assert.equal(result.report.script_lines, 19000);
  assert.deepEqual(result.report.binary_excluded_files, [
    { path: "docs/diagram.png", reason: "documentation" },
  ]);
});

test("refuses uncommitted work and invalid bases, reports binaries, and identifies unmeasurable submodules", (testContext) => {
  const repo = repository(testContext);
  repo.write("README.md", "base\n");
  const initial = repo.commit();
  repo.git("checkout", "-b", "slice");
  repo.write("pending.ts", "pending\n");
  const dirty = repo.measure();
  assert.equal(dirty.status, 2);
  assert.match(dirty.report.error, /Dirty checkout/);
  repo.commit();
  const invalid = repo.measure("missing-base");
  assert.equal(invalid.status, 2);
  assert.equal(invalid.report.passed, false);

  repo.write("asset.bin", Buffer.from([0, 1, 2]));
  repo.commit();
  const binary = repo.measure();
  assert.equal(binary.status, 0);
  assert.deepEqual(binary.report.binary_feature_files, ["asset.bin"]);
  repo.git("rm", "asset.bin");
  repo.commit();
  repo.git("clone", "--quiet", ".", "vendor");
  repo.git("-C", "vendor", "checkout", "--quiet", initial);
  repo.git("update-index", "--add", "--cacheinfo", `160000,${initial},vendor`);
  repo.git("-c", "core.hooksPath=/dev/null", "commit", "--no-gpg-sign", "-m", "submodule");
  const submodule = repo.measure();
  assert.equal(submodule.status, 2);
  assert.match(submodule.report.error, /Submodule change/);
});
