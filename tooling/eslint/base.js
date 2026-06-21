import js from "@eslint/js";
import tseslint from "typescript-eslint";

/**
 * Baseline flat config shared by every package.
 *
 * NOTE: This is the SCAFFOLD baseline only. The full §3.4 guardrail set
 * (complexity/size limits, magic-value rules, type-aware unsafe-* rules,
 * boundary enforcement, duplication, security, no-inline-config) lands in
 * issue P00-04. Keep this file in sync with that work.
 *
 * @type {import("typescript-eslint").ConfigArray}
 */
export const baseConfig = tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/node_modules/**",
      "**/next-env.d.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-console": "error",
      eqeqeq: ["error", "always"],
    },
  },
);

export default baseConfig;
