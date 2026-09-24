import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";

const tier = process.argv[2];
const validTiers = new Set(["unit", "integration", "transport"]);
if (!validTiers.has(tier)) {
  process.stderr.write("Usage: node scripts/run-test-tier.mjs <unit|integration|transport>\n");
  process.exit(2);
}

const packageDirectory = process.cwd();
const testRoot = path.join(packageDirectory, "test");
const suffix = `.${tier}.test`;
const testFiles = existsSync(testRoot)
  ? readdirSync(testRoot, { recursive: true, withFileTypes: true })
      .filter((entry) => {
        if (!entry.isFile()) return false;
        return [".js", ".mjs", ".ts", ".tsx"].some((extension) =>
          entry.name.endsWith(`${suffix}${extension}`),
        );
      })
      .map((entry) => path.relative(packageDirectory, path.join(entry.parentPath, entry.name)))
      .toSorted()
  : [];

if (testFiles.length === 0) {
  process.stdout.write(`No ${tier} tests in ${packageDirectory}.\n`);
  process.exit(0);
}

const infrastructure = tier === "integration" || tier === "transport";
const needsTypeScriptLoader = testFiles.some(
  (file) => file.endsWith(".ts") || file.endsWith(".tsx"),
);
const commonArguments = [
  ...(infrastructure ? ["--env-file-if-exists=../../.env"] : []),
  ...(needsTypeScriptLoader ? ["--import", "tsx"] : []),
  "--test",
  ...(infrastructure ? ["--test-concurrency=1"] : []),
];
const reportArguments =
  process.env.CI === "true" ? ciReportArguments(tier) : ["--test-reporter=spec"];

const result = spawnSync(process.execPath, [...commonArguments, ...reportArguments, ...testFiles], {
  env: { ...process.env, NODE_ENV: "test" },
  stdio: "inherit",
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);

function ciReportArguments(testTier) {
  const junitDirectory = path.join(packageDirectory, "reports", "junit");
  const coverageDirectory = path.join(packageDirectory, "coverage", testTier);
  mkdirSync(junitDirectory, { recursive: true });
  mkdirSync(coverageDirectory, { recursive: true });
  return [
    "--experimental-test-coverage",
    "--test-coverage-include=src/**",
    "--test-reporter=spec",
    "--test-reporter-destination=stdout",
    "--test-reporter=junit",
    `--test-reporter-destination=${path.join(junitDirectory, `${testTier}.xml`)}`,
    "--test-reporter=lcov",
    `--test-reporter-destination=${path.join(coverageDirectory, "lcov.info")}`,
  ];
}
