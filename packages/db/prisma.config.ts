import { config as loadEnvironment } from "dotenv";
import { defineConfig } from "prisma/config";

loadEnvironment({ path: new URL("../../.env", import.meta.url), quiet: true });

const databaseUrl = process.env.DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node --import tsx ../../scripts/seed.ts",
  },
  ...(databaseUrl === undefined ? {} : { datasource: { url: databaseUrl } }),
});
