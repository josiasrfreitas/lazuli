import path from "node:path";

import js from "@eslint/js";
import importPlugin from "eslint-plugin-import";
import security from "eslint-plugin-security";
import sonarjs from "eslint-plugin-sonarjs";
import unicorn from "eslint-plugin-unicorn";
import unusedImports from "eslint-plugin-unused-imports";
import tseslint from "typescript-eslint";

import { createBoundaryConfig } from "./boundaries.js";

const processEnvironmentRestriction = {
  message: "Read environment variables in a validated config module and inject the result.",
  selector: "MemberExpression[object.name='process'][property.name='env']",
};

const ignoreConfig = {
  ignores: [
    "**/dist/**",
    "**/.next/**",
    "**/.turbo/**",
    "**/node_modules/**",
    "**/next-env.d.ts",
    "**/src/generated/**",
  ],
};

const linterConfig = {
  linterOptions: {
    noInlineConfig: true,
    reportUnusedDisableDirectives: "error",
  },
};

const javascriptConfig = {
  ...tseslint.configs.disableTypeChecked,
  files: ["**/*.{js,mjs,cjs}"],
  languageOptions: {
    ...tseslint.configs.disableTypeChecked.languageOptions,
    globals: {
      Buffer: "readonly",
      console: "readonly",
      process: "readonly",
    },
  },
};

const sharedRulesConfig = {
  plugins: {
    import: importPlugin,
    sonarjs,
    "unused-imports": unusedImports,
  },
  rules: {
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
    "unused-imports/no-unused-imports": "error",
    "unused-imports/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    complexity: ["error", 10],
    "max-lines-per-function": ["error", { max: 50, skipBlankLines: true, skipComments: true }],
    "max-lines": ["error", { max: 250, skipBlankLines: true, skipComments: true }],
    "max-depth": ["error", 4],
    "max-params": ["error", 2],
    "max-statements": ["error", 20],
    "max-nested-callbacks": ["error", 3],
    "max-classes-per-file": ["error", 1],
    "sonarjs/cognitive-complexity": ["error", 15],
    "no-magic-numbers": [
      "error",
      { enforceConst: true, ignore: [0, 1, -1, 2], ignoreArrayIndexes: true },
    ],
    "no-console": "error",
    "id-length": ["error", { exceptions: ["T"], min: 2 }],
    eqeqeq: ["error", "always"],
    "sonarjs/no-duplicate-string": ["error", { threshold: 3 }],
    "sonarjs/no-identical-functions": "error",
    "import/no-cycle": ["error", { ignoreExternal: true }],
    "no-restricted-syntax": ["error", processEnvironmentRestriction],
    "unicorn/filename-case": "off",
    "unicorn/no-null": "off",
    "unicorn/prevent-abbreviations": "off",
  },
};

const typescriptRulesConfig = {
  files: ["**/*.{ts,tsx,mts,cts}"],
  rules: {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/no-unsafe-argument": "error",
    "@typescript-eslint/no-unsafe-assignment": "error",
    "@typescript-eslint/no-unsafe-call": "error",
    "@typescript-eslint/no-unsafe-member-access": "error",
    "@typescript-eslint/no-unsafe-return": "error",
    "@typescript-eslint/explicit-function-return-type": [
      "error",
      {
        allowExpressions: true,
        allowHigherOrderFunctions: true,
        allowTypedFunctionExpressions: true,
      },
    ],
  },
};

const configModuleOverride = {
  files: ["**/{config,env}.{js,cjs,mjs,ts,tsx,mts,cts}", "prisma.config.ts"],
  rules: {
    "no-restricted-syntax": "off",
  },
};

function createProjectConfig(tsconfigRootDir) {
  return {
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.json"],
        tsconfigRootDir,
      },
    },
    settings: {
      "import/resolver": {
        typescript: {
          project: path.join(tsconfigRootDir, "tsconfig.json"),
        },
      },
    },
  };
}

/**
 * Creates the type-aware flat config for one workspace package.
 *
 * @param {{ packageType?: "api" | "base" | "domain" | "job-contracts" | "ui" | "web" | "worker"; tsconfigRootDir: string }} options
 * @returns {import("typescript-eslint").ConfigArray}
 */
export function createConfig({ packageType = "base", tsconfigRootDir }) {
  return tseslint.config(
    ignoreConfig,
    linterConfig,
    js.configs.recommended,
    unicorn.configs["flat/recommended"],
    security.configs.recommended,
    ...tseslint.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    createProjectConfig(tsconfigRootDir),
    javascriptConfig,
    sharedRulesConfig,
    createBoundaryConfig(packageType),
    typescriptRulesConfig,
    configModuleOverride,
  );
}
