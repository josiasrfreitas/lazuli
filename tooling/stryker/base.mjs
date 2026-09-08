/**
 * Shared StrykerJS configuration for Lazuli packages.
 *
 * Mutate through unit tests and, where needed, integration tests. Infrastructure-backed
 * suites use one worker because their fixtures are isolated by file, not worker.
 *
 * @param {{ integration?: boolean; mutate?: string[]; testFiles?: string[]; nodeArgs?: string[] }} [options]
 * @returns {import("@stryker-mutator/api/core").PartialStrykerOptions}
 */
export function createStrykerConfig(options = {}) {
  return {
    // pnpm's strict layout hides workspace plugins from Stryker's default "@stryker-mutator/*"
    // glob, so the runner is named explicitly.
    plugins: ["@stryker-mutator/tap-runner"],
    testRunner: "tap",
    tap: {
      testFiles: options.testFiles ?? [
        options.integration ? "test/**/*.@(unit|integration).test.ts" : "test/**/*.unit.test.ts",
      ],
      // Node >= 23 defaults to the "spec" reporter even off a TTY; the runner parses TAP.
      nodeArgs: ["--test-reporter=tap", "--import", "tsx", ...(options.nodeArgs ?? [])],
      forceBail: true,
    },
    ...(options.integration ? { concurrency: 1, timeoutMS: 10_000 } : {}),
    mutate: options.mutate ?? ["src/**/*.ts", "!src/**/*.d.ts", "!src/generated/**"],
    ignorePatterns: ["dist", ".next", ".turbo", "coverage", "/reports", "storybook-static"],
    coverageAnalysis: "perTest",
    incremental: true,
    incrementalFile: "reports/stryker-incremental.json",
    reporters: ["clear-text", "progress", "html", "json"],
    htmlReporter: { fileName: "reports/mutation/index.html" },
    jsonReporter: { fileName: "reports/mutation/report.json" },
    thresholds: { high: 90, low: 75, break: 75 },
    tempDirName: ".stryker-tmp",
    cleanTempDir: true,
  };
}
