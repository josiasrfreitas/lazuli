import { createConfig } from "@lazuli/eslint-config/base";

export default [
  ...createConfig({ tsconfigRootDir: import.meta.dirname }),
  {
    files: ["scripts/guardrails/*.mjs"],
    // Hooks are configuration boundaries and resolve paths supplied by Claude Code.
    rules: {
      "no-restricted-syntax": "off",
      "security/detect-non-literal-fs-filename": "off",
    },
  },
  {
    files: ["scripts/runtime-check.mjs"],
    // Runtime preflight is the validated boundary for process.env reads.
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  {
    files: [
      "scripts/changed-source-files.mjs",
      "scripts/changed-source-covered.mjs",
      "scripts/mutate-changed.mjs",
    ],
    // Change gates spawn git, node, and Stryker over paths derived from the git diff.
    rules: {
      "no-restricted-syntax": "off",
      "security/detect-child-process": "off",
      "security/detect-non-literal-fs-filename": "off",
    },
  },
  {
    files: ["scripts/test/*.mjs"],
    // Script tests build temporary git repositories and fake binaries as deterministic fixtures.
    rules: {
      "no-restricted-syntax": "off",
      "security/detect-child-process": "off",
      "security/detect-non-literal-fs-filename": "off",
    },
  },
  {
    files: ["scripts/test-styles.mjs"],
    // Test inputs are fixed host entrypoints and class names, never user input.
    rules: {
      "security/detect-non-literal-fs-filename": "off",
      "security/detect-non-literal-regexp": "off",
    },
  },
];
