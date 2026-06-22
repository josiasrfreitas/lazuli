import { execFileSync } from "node:child_process";

import { getDatabaseProcessEnvironment, getDatabaseUrl } from "../src/config.js";
import { assertLocalDatabaseUrl } from "./reset-url.js";

const databaseUrl = getDatabaseUrl();

assertLocalDatabaseUrl(databaseUrl);

const environment = getDatabaseProcessEnvironment();
const runPrisma = (arguments_: readonly string[]): void => {
  execFileSync("pnpm", ["exec", "prisma", ...arguments_], {
    env: environment,
    stdio: "inherit",
  });
};

runPrisma(["migrate", "reset", "--force"]);
runPrisma(["db", "seed"]);
