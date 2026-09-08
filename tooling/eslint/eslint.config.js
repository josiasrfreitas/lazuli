import { createConfig } from "./base.js";

export default [
  { ignores: ["test/fixtures/**"] },
  ...createConfig({ tsconfigRootDir: import.meta.dirname }),
  // These literals define the no-magic-numbers thresholds rather than application behavior.
  { files: ["base.js"], rules: { "no-magic-numbers": "off" } },
  {
    files: ["test/guardrails.unit.test.js"],
    // Guardrail tests create temporary probe projects with dynamic fixture paths.
    rules: { "security/detect-non-literal-fs-filename": "off" },
  },
];
