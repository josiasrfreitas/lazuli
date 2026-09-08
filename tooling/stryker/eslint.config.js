import { createConfig } from "@lazuli/eslint-config/base";

export default [
  ...createConfig({ tsconfigRootDir: import.meta.dirname }),
  // Threshold literals configure Stryker; they are not application behavior.
  { files: ["base.mjs"], rules: { "no-magic-numbers": "off" } },
];
