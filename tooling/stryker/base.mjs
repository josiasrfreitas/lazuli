/**
 * Shared StrykerJS configuration for Lazuli packages.
 *
 * Mutation testing runs against the unit tier only (files suffixed `.unit.test.ts`): the
 * integration and transport tiers need Postgres and are too slow to multiply by hundreds of
 * mutants. Packages call `createStrykerConfig` from their own `stryker.config.mjs`.
 *
 * @param {{ mutate?: string[]; testFiles?: string[]; nodeArgs?: string[] }} [options]
 * @returns {import("@stryker-mutator/api/core").PartialStrykerOptions}
 */
export function createStrykerConfig(options = {}) {
  return {
    // pnpm's strict layout hides workspace plugins from Stryker's default "@stryker-mutator/*"
    // glob, so the runner is named explicitly.
    plugins: ["@stryker-mutator/tap-runner"],
    // Stryker rewrites tsconfig.json in its sandbox through the TypeScript compiler API, which
    // the repository's TypeScript 7 (native preview) no longer exposes. Pointing at a file that
    // does not exist skips that rewrite; tsx still reads the real tsconfig.json from the sandbox.
    tsconfigFile: "tsconfig.stryker-none.json",
    testRunner: "tap",
    tap: {
      testFiles: options.testFiles ?? ["test/**/*.unit.test.ts"],
      // Node >= 23 defaults to the "spec" reporter even off a TTY; the runner parses TAP.
      nodeArgs: ["--test-reporter=tap", "--import", "tsx", ...(options.nodeArgs ?? [])],
      forceBail: true,
    },
    mutate: options.mutate ?? ["src/**/*.ts", "!src/**/*.d.ts", "!src/generated/**"],
    ignorePatterns: ["dist", ".next", ".turbo", "coverage", "reports", "storybook-static"],
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
