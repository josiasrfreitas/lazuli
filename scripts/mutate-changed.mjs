// Mutation gate for changed code: runs StrykerJS on the production files changed since the
// merge base, one package at a time, when the package has executable unit tests.
// Decision 0017 and docs/testing/README.md describe the rule this enforces.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  groupSourceFilesByPackage,
  listChangedFiles,
  readOption,
  resolveBaseRef,
} from "./changed-source-files.mjs";

const TESTING_GUIDE = "docs/testing/README.md";
const UNIT_TEST_SUFFIX = ".unit.test.ts";
const EXCLUDED_PACKAGES = new Set(["apps/web", "packages/ui"]);

function mutationGroups() {
  return [...groups].filter(([packageDirectory]) => !EXCLUDED_PACKAGES.has(packageDirectory));
}

function hasUnitTests(packageDirectory) {
  const testDirectory = path.join(packageDirectory, "test");

  return (
    existsSync(testDirectory) &&
    readdirSync(testDirectory, { recursive: true, withFileTypes: true }).some(
      (entry) => entry.isFile() && entry.name.endsWith(UNIT_TEST_SUFFIX),
    )
  );
}

const baseRef = resolveBaseRef(readOption("base"));
const groups = groupSourceFilesByPackage(listChangedFiles(baseRef));
// Unconfigured packages with unit tests still reach the fail-closed gate.
if (process.argv.includes("--scope-only")) {
  process.stdout.write(
    `${mutationGroups().some(([packageDirectory]) => hasUnitTests(packageDirectory))}\n`,
  );
  process.exit(0);
}

const failures = [];
const unconfigured = [];
let mutatedPackages = 0;

for (const [packageDirectory, files] of mutationGroups()) {
  if (!hasUnitTests(packageDirectory)) {
    process.stdout.write(
      `${packageDirectory}: no unit tests, outside the mutation gate (${files.length} changed file(s)).\n`,
    );
    continue;
  }

  if (!existsSync(path.join(packageDirectory, "stryker.config.mjs"))) {
    // A package with unit tests but no mutation config is inside the gate's scope: fail closed
    // rather than report a pass that mutated nothing.
    unconfigured.push(packageDirectory);
    continue;
  }

  mutatedPackages += 1;
  process.stdout.write(`\n${packageDirectory}: mutating ${files.join(", ")}\n`);
  const manifest = JSON.parse(readFileSync(path.join(packageDirectory, "package.json"), "utf8"));
  const build = spawnSync(
    "pnpm",
    ["exec", "turbo", "run", "build", `--filter=${manifest.name}...`],
    { stdio: "inherit" },
  );
  if (build.status !== 0) {
    failures.push(packageDirectory);
    continue;
  }
  const result = spawnSync("pnpm", ["run", "mutate", "--mutate", files.join(",")], {
    cwd: packageDirectory,
    stdio: "inherit",
  });

  if (result.status !== 0) failures.push(packageDirectory);
}

if (unconfigured.length > 0) {
  process.stderr.write(
    `\nChanged packages with unit tests but no stryker.config.mjs: ${unconfigured.join(", ")}.\n` +
      `Add the config (see tooling/stryker/base.mjs and ${TESTING_GUIDE}) so the gate can mutate them.\n`,
  );
  process.exitCode = 1;
}

if (mutatedPackages === 0 && unconfigured.length === 0) {
  process.stdout.write(
    `No changed source files under a mutation-tested package (base: ${baseRef}).\n`,
  );
} else if (failures.length > 0) {
  process.stderr.write(
    `\nMutation gate failed in: ${failures.join(", ")}.\n` +
      `Unit-covered changed-file mutation must score at least 70. Investigate survivors without treating ` +
      `mutation as proof of contract relevance. See ${TESTING_GUIDE}.\n`,
  );
  process.exitCode = 1;
} else if (mutatedPackages > 0) {
  process.stdout.write(`\nMutation gate passed for ${mutatedPackages} package(s).\n`);
}
