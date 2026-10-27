import { createRequire } from "node:module";
import path from "node:path";

import base from "./base.json" with { type: "json" };
import { createBoundaryConfig } from "./boundaries.js";

const require = createRequire(import.meta.url);

/** Build the same portable config for isolated guardrail probes. */
export function createConfig({ packageType = "base", tsconfigRootDir }) {
  const config = { ...base, rules: { ...base.rules } };
  config.jsPlugins = config.jsPlugins.map(({ name, specifier }) => ({
    name,
    specifier: require.resolve(specifier),
  }));
  const boundary = createBoundaryConfig(packageType).rules;
  Object.assign(config.rules, {
    "no-restricted-imports": boundary["no-restricted-imports"],
    "import-x-compat/no-restricted-paths": boundary["import-x/no-restricted-paths"],
  });
  config.settings = {
    "import-x/resolver": {
      [require.resolve("eslint-import-resolver-typescript")]: {
        project: path.join(tsconfigRootDir, "tsconfig.json"),
      },
    },
  };
  return config;
}
