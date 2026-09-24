/**
 * Shared StrykerJS configuration for Lazuli packages.
 *
 * Mutation measures unit-test detection only. Integration and transport run in their own tiers.
 *
 * @param {{ mutate?: string[]; nodeArgs?: string[] }} [options]
 * @returns {import("@stryker-mutator/api/core").PartialStrykerOptions}
 */
export function createStrykerConfig(options = {}) {
  return {
    // pnpm's strict layout hides workspace plugins from Stryker's default "@stryker-mutator/*"
    // glob, so the runner is named explicitly.
    plugins: ["@stryker-mutator/tap-runner"],
    testRunner: "tap",
    tap: {
      testFiles: ["test/**/*.unit.test.ts"],
      // Node >= 23 defaults to the "spec" reporter even off a TTY; the runner parses TAP.
      nodeArgs: ["--test-reporter=tap", "--import", "tsx", ...(options.nodeArgs ?? [])],
      forceBail: true,
    },
    mutate: options.mutate ?? ["src/**/*.ts", "!src/**/*.d.ts", "!src/generated/**"],
    ignorePatterns: ["dist", ".next", ".turbo", "coverage", "/reports", "storybook-static"],
    coverageAnalysis: "perTest",
    incremental: true,
    incrementalFile: "reports/stryker-incremental.json",
    reporters: ["clear-text", "progress", "html", "json"],
    htmlReporter: { fileName: "reports/mutation/index.html" },
    jsonReporter: { fileName: "reports/mutation/report.json" },
    // The package wrapper gates the unit-covered score at 70, excluding NoCoverage.
    thresholds: { high: 90, low: 70, break: 0 },
    // Leave room for TAP child-process startup under CI load; 5s caused resource-delay timeouts.
    timeoutMS: 15_000,
    tempDirName: ".stryker-tmp",
    cleanTempDir: true,
  };
}
