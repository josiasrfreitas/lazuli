import { readFileSync } from "node:fs";

import { OPTIONAL_RUNTIME_ENVIRONMENT, REQUIRED_RUNTIME_ENVIRONMENT } from "./runtime-env.mjs";

const turboConfig = JSON.parse(readFileSync("turbo.json", "utf8"));
const turboEnvironment = new Set(turboConfig.globalEnv ?? []);
const expectedEnvironment = [...REQUIRED_RUNTIME_ENVIRONMENT, ...OPTIONAL_RUNTIME_ENVIRONMENT];
const missing = expectedEnvironment.filter((name) => !turboEnvironment.has(name));

if (missing.length > 0) {
  process.stderr.write("turbo.json globalEnv is missing runtime environment variables:\n");

  for (const name of missing) {
    process.stderr.write(`- ${name}\n`);
  }

  process.exitCode = 1;
} else {
  process.stdout.write("Turbo runtime environment allowlist passed.\n");
}
