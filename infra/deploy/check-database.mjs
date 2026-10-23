import { createRequire } from "node:module";

const require = createRequire(new URL("../../packages/db/package.json", import.meta.url));
const { Client } = require("pg");
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
});
try {
  await client.connect();
  const result = await client.query("SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()");
  if (result.rows[0]?.ssl !== true) throw new Error("TLS required");
  // A migration history check prevents starting the app against an empty database.
  const migrations = await client.query(
    "SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS present",
  );
  if (!migrations.rows[0]?.present) throw new Error("Migrations required");
  console.log("PASS: runtime database connection, TLS and migration history present");
} catch {
  console.error("Database readiness check failed; connection details withheld.");
  process.exitCode = 1;
} finally {
  await client.end();
}
