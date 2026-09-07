// Coverage gate for changed code: every production file changed since the merge base must be
// executed by at least one test, in any tier. Uses the Node test runner's built-in coverage;
// no coverage percentage is enforced, only "executed at all". See docs/testing/README.md.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  groupSourceFilesByPackage,
  listChangedFiles,
  readOption,
  resolveBaseRef,
} from "./changed-source-files.mjs";

const TESTING_GUIDE = "docs/testing/README.md";
const TIER_DIRECTORIES = { behavior: "test/behavior", db: "test/db", unit: "test" };
const DATABASE_TIERS = new Set(["db", "behavior"]);
const ROOT_ENV_FILE = path.resolve(".env");

const baseRef = resolveBaseRef(readOption("base"));
const tiers = (readOption("tiers") ?? "unit,db,behavior").split(",");
const groups = groupSourceFilesByPackage(listChangedFiles(baseRef));
const uncovered = [];

for (const [packageDirectory, files] of groups) {
  const executed = collectExecutedFiles(packageDirectory);
  for (const file of files) {
    if (!executed.has(path.resolve(packageDirectory, file)))
      uncovered.push(`${packageDirectory}/${file}`);
  }
}

if (groups.size === 0) {
  process.stdout.write(`No changed source files (base: ${baseRef}).\n`);
} else if (uncovered.length > 0) {
  process.stderr.write(
    `\nChanged source files that no test executes:\n${uncovered.map((file) => `  ${file}\n`).join("")}` +
      `Add a test in the tier the change belongs to. See ${TESTING_GUIDE}.\n`,
  );
  process.exitCode = 1;
} else {
  process.stdout.write(`Coverage gate passed: every changed source file is executed by a test.\n`);
}

function listTestFiles(packageDirectory, tier) {
  const directory = path.join(packageDirectory, TIER_DIRECTORIES[tier]);
  if (!existsSync(directory)) return [];

  return readdirSync(directory)
    .filter((entry) => entry.endsWith(".test.ts") || entry.endsWith(".test.tsx"))
    .map((entry) => path.join(TIER_DIRECTORIES[tier], entry));
}

function runTierWithCoverage(packageDirectory, tier) {
  const testFiles = listTestFiles(packageDirectory, tier);
  if (testFiles.length === 0) return;

  const lcovFile = path.join("coverage", `changed-${tier}.lcov`);
  mkdirSync(path.join(packageDirectory, "coverage"), { recursive: true });
  const databaseImports = DATABASE_TIERS.has(tier) ? ["--import", "dotenv/config"] : [];
  const args = [
    ...databaseImports,
    "--import",
    "tsx",
    "--test",
    "--experimental-test-coverage",
    "--test-coverage-include=src/**",
    "--test-reporter=lcov",
    `--test-reporter-destination=${lcovFile}`,
    ...testFiles,
  ];
  const result = spawnSync("node", args, {
    cwd: packageDirectory,
    env: { ...process.env, DOTENV_CONFIG_PATH: ROOT_ENV_FILE, NODE_ENV: "test" },
    stdio: ["ignore", "ignore", "inherit"],
  });

  if (result.status !== 0) {
    process.stderr.write(
      `${packageDirectory} ${tier}: tests failed; fix them before the coverage gate.\n`,
    );
    process.exitCode = 1;
  }

  return path.join(packageDirectory, lcovFile);
}

function parseExecutedFiles(lcovFile, packageDirectory) {
  const executed = new Set();
  let currentFile;

  for (const line of readFileSync(lcovFile, "utf8").split("\n")) {
    if (line.startsWith("SF:"))
      currentFile = path.resolve(packageDirectory, line.slice("SF:".length));
    if (line.startsWith("LH:") && Number(line.slice("LH:".length)) > 0 && currentFile)
      executed.add(currentFile);
  }

  return executed;
}

function collectExecutedFiles(packageDirectory) {
  const executed = new Set();

  for (const tier of tiers) {
    const lcovFile = runTierWithCoverage(packageDirectory, tier);
    if (lcovFile && existsSync(lcovFile)) {
      for (const file of parseExecutedFiles(lcovFile, packageDirectory)) executed.add(file);
    }
  }

  return executed;
}
