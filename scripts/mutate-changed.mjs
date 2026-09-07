// Mutation gate for changed code: runs StrykerJS on the production files changed since the
// merge base, one package at a time, in every package that has a stryker.config.mjs.
// Decision 0017 and docs/testing/README.md describe the rule this enforces.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

import {
  groupSourceFilesByPackage,
  listChangedFiles,
  readOption,
  resolveBaseRef,
} from "./changed-source-files.mjs";

const TESTING_GUIDE = "docs/testing/README.md";

const baseRef = resolveBaseRef(readOption("base"));
const groups = groupSourceFilesByPackage(listChangedFiles(baseRef));
const failures = [];
let mutatedPackages = 0;

for (const [packageDirectory, files] of groups) {
  if (!existsSync(path.join(packageDirectory, "stryker.config.mjs"))) {
    process.stdout.write(
      `${packageDirectory}: no stryker.config.mjs, skipped (${files.length} changed file(s)).\n`,
    );
    continue;
  }

  mutatedPackages += 1;
  process.stdout.write(`\n${packageDirectory}: mutating ${files.join(", ")}\n`);
  const result = spawnSync("pnpm", ["exec", "stryker", "run", "--mutate", files.join(",")], {
    cwd: packageDirectory,
    stdio: "inherit",
  });

  if (result.status !== 0) failures.push(packageDirectory);
}

if (mutatedPackages === 0) {
  process.stdout.write(
    `No changed source files under a mutation-tested package (base: ${baseRef}).\n`,
  );
} else if (failures.length > 0) {
  process.stderr.write(
    `\nMutation gate failed in: ${failures.join(", ")}.\n` +
      `Surviving mutants in files you changed mean the tests do not detect those bugs. ` +
      `Kill them with a test, or list them in the pull request with a reason. See ${TESTING_GUIDE}.\n`,
  );
  process.exitCode = 1;
} else {
  process.stdout.write(`\nMutation gate passed for ${mutatedPackages} package(s).\n`);
}
