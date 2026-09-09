import { createConfig } from "./base.js";

export default [
  { ignores: ["test/fixtures/**"] },
  ...createConfig({ tsconfigRootDir: import.meta.dirname }),
  // These literals define the no-magic-numbers thresholds rather than application behavior.
  { files: ["base.js"], rules: { "no-magic-numbers": "off" } },
  {
    files: [
      "test/guardrails.unit.test.js",
      "test/quality-changed-cli.unit.test.js",
      "test/test-quality.unit.test.js",
    ],
    // Guardrail tests create temporary probe projects with dynamic fixture paths.
    rules: {
      "max-lines-per-function": "off",
      "max-params": "off",
      "no-magic-numbers": "off",
      "no-restricted-syntax": "off",
      "security/detect-non-literal-fs-filename": "off",
      "sonarjs/no-duplicate-string": "off",
      "unicorn/no-await-expression-member": "off",
    },
  },
  {
    files: ["quality-changed.mjs"],
    // This CLI parses git diffs and test ASTs from repository-controlled paths.
    rules: {
      "complexity": "off",
      "no-restricted-syntax": "off",
      "security/detect-non-literal-fs-filename": "off",
      "security/detect-unsafe-regex": "off",
      "sonarjs/no-duplicate-string": "off",
      "unicorn/no-array-callback-reference": "off",
      "unicorn/no-array-for-each": "off",
      "unicorn/no-process-exit": "off",
    },
  },
];
