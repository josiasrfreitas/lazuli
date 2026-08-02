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
    files: ["scripts/test-styles.mjs"],
    // Test inputs are fixed host entrypoints and class names, never user input.
    rules: {
      "security/detect-non-literal-fs-filename": "off",
      "security/detect-non-literal-regexp": "off",
    },
  },
];
