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
];
