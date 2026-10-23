import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const require = createRequire(new URL("../../packages/db/package.json", import.meta.url));
const { Client } = require("pg");
const environment = process.env.LAZULI_ENV;
if (!["staging", "prod"].includes(environment)) throw new Error("Invalid environment");
const url = new URL(process.env.DATABASE_URL);
if (url.pathname !== `/lazuli_${environment}` || url.username !== `lazuli_${environment}_owner`) {
  throw new Error("Migrations require the matching owner database/role");
}
// Capture CLI output: database URLs or failed SQL must not reach public Actions logs.
const migration = spawnSync("pnpm", ["--filter", "@lazuli/db", "prisma:deploy"], {
  env: process.env,
  encoding: "utf8",
  timeout: 600000,
});
if (migration.status !== 0) {
  console.error("Migration failed. Inspect privately; automatic schema rollback is disabled.");
  process.exitCode = 1;
} else {
  const client = new Client({ connectionString: url.href, connectionTimeoutMillis: 10000 });
  try {
    await client.connect();
    await client.query(
      `REVOKE ALL ON public._prisma_migrations FROM lazuli_${environment}_runtime`,
    );
    const result = await client.query(
      "SELECT count(*)::int AS failures FROM public._prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL",
    );
    if (result.rows[0].failures !== 0) throw new Error("Incomplete migrations");
    console.log("PASS: migrations applied; runtime cannot modify migration history");
  } catch {
    console.error("Post-migration permission/history check failed; details withheld.");
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}
