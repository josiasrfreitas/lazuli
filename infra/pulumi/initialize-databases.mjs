import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(new URL("../../packages/db/package.json", import.meta.url));
const { Client } = require("pg");
const profile = process.env.AWS_PROFILE || "lazuli";
const region = "us-east-2";
const cwd = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.LAZULI_DB_TUNNEL_PORT || "15432");
assert.ok(Number.isInteger(port) && port > 1024 && port < 65536);
assert.ok(process.env.LAZULI_RDS_CA_FILE, "Set LAZULI_RDS_CA_FILE to the AWS RDS CA bundle");
const env = { ...process.env, AWS_PROFILE: profile, AWS_REGION: region };
function command(binary, args) {
  return execFileSync(binary, args, {
    cwd,
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}
function aws(...args) {
  return JSON.parse(
    command("aws", [...args, "--profile", profile, "--region", region, "--output", "json"]),
  );
}
function pulumi(...args) {
  return command("pulumi", [...args, "--non-interactive"]);
}
const identifier = (value) => `"${value.replaceAll('"', '""')}"`;
const literal = (value) => `'${value.replaceAll("'", "''")}'`;

let phase = "connect admin";
async function initialize() {
  assert.equal(aws("sts", "get-caller-identity").Account, "413781344359");
  assert.ok(!process.env.PULUMI_BACKEND_URL, "Use the project S3 backend");
  const shared = JSON.parse(pulumi("stack", "output", "shared", "--stack", "shared", "--json"));
  const secret = JSON.parse(
    aws("secretsmanager", "get-secret-value", "--secret-id", shared.databaseAdminSecretArn)
      .SecretString,
  );
  assert.equal(secret.username, "lazuli_admin");
  const ca = readFileSync(process.env.LAZULI_RDS_CA_FILE, "utf8");
  const connection = {
    host: "127.0.0.1",
    port,
    ssl: { ca, servername: shared.databaseAddress, rejectUnauthorized: true },
    connectionTimeoutMillis: 10000,
  };
  async function connect(database, user = secret.username, password = secret.password) {
    const client = new Client({ ...connection, database, user, password });
    try {
      await client.connect();
    } catch (error) {
      await client.end();
      throw error;
    }
    return client;
  }
  const admin = await connect("lazuli_admin");
  const credentials = [];
  try {
    await admin.query("REVOKE CONNECT ON DATABASE lazuli_admin FROM PUBLIC");
    for (const environment of ["staging", "prod"]) {
      const database = `lazuli_${environment}`;
      const owner = `${database}_owner`;
      const runtime = `${database}_runtime`;
      const ownerPassword = pulumi(
        "config",
        "get",
        "databaseOwnerPassword",
        "--stack",
        environment,
      );
      const runtimePassword = pulumi(
        "config",
        "get",
        "databaseRuntimePassword",
        "--stack",
        environment,
      );
      for (const [role, password] of [
        [owner, ownerPassword],
        [runtime, runtimePassword],
      ]) {
        phase = `configure role ${role}`;
        const existing = await admin.query("SELECT rolname FROM pg_roles WHERE rolname = $1", [
          role,
        ]);
        if (!existing.rowCount) await admin.query(`CREATE ROLE ${identifier(role)}`);
        const attributes = await admin.query(
          "SELECT rolsuper, rolreplication, rolbypassrls FROM pg_roles WHERE rolname = $1",
          [role],
        );
        assert.deepEqual(attributes.rows, [
          { rolsuper: false, rolreplication: false, rolbypassrls: false },
        ]);
        await admin.query(
          `ALTER ROLE ${identifier(role)} LOGIN NOCREATEDB NOCREATEROLE CONNECTION LIMIT 10 PASSWORD ${literal(password)}`,
        );
      }
      phase = `grant owner ${owner}`;
      // PostgreSQL 16 requires permission to SET ROLE to create a database for it.
      await admin.query(`GRANT ${identifier(owner)} TO lazuli_admin WITH SET TRUE`);
      phase = `create database ${database}`;
      const existing = await admin.query(
        "SELECT pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname = $1",
        [database],
      );
      if (existing.rowCount)
        assert.equal(existing.rows[0].owner, owner, "Existing database has an unexpected owner");
      else await admin.query(`CREATE DATABASE ${identifier(database)} OWNER ${identifier(owner)}`);
      await admin.query(`REVOKE ALL ON DATABASE ${identifier(database)} FROM PUBLIC`);
      await admin.query(
        `GRANT CONNECT ON DATABASE ${identifier(database)} TO ${identifier(runtime)}, ${identifier(owner)}, lazuli_admin`,
      );
      phase = `extensions ${database}`;
      const db = await connect(database);
      try {
        await db.query("CREATE EXTENSION IF NOT EXISTS pg_trgm");
        await db.query("CREATE EXTENSION IF NOT EXISTS btree_gist");
      } finally {
        await db.end();
      }
      phase = `schema grants ${database}`;
      const migrations = await connect(database, owner, ownerPassword);
      try {
        await migrations.query("REVOKE CREATE ON SCHEMA public FROM PUBLIC");
        await migrations.query(`GRANT USAGE ON SCHEMA public TO ${identifier(runtime)}`);
        await migrations.query(
          `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${identifier(runtime)}`,
        );
        await migrations.query(
          `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${identifier(runtime)}`,
        );
        await migrations.query(
          `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${identifier(runtime)}`,
        );
        await migrations.query(
          `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${identifier(runtime)}`,
        );
        const history = await migrations.query(
          "SELECT to_regclass('public._prisma_migrations') AS name",
        );
        if (history.rows[0].name)
          await migrations.query(
            `REVOKE ALL ON public._prisma_migrations FROM ${identifier(runtime)}`,
          );
      } finally {
        await migrations.end();
      }
      credentials.push({ database, runtime, password: runtimePassword });
    }
    for (const { database, runtime, password } of credentials) {
      const client = await connect(database, runtime, password);
      try {
        const result = await client.query(
          "SELECT current_database() AS database, current_user AS username, ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()",
        );
        assert.deepEqual(result.rows, [{ database, username: runtime, ssl: true }]);
        const permissions = await client.query(
          "SELECT rolcreatedb, rolcreaterole, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user",
        );
        assert.deepEqual(permissions.rows, [
          { rolcreatedb: false, rolcreaterole: false, rolsuper: false, rolbypassrls: false },
        ]);
      } finally {
        await client.end();
      }
      for (const other of [
        "lazuli_admin",
        ...credentials.map((entry) => entry.database).filter((name) => name !== database),
      ]) {
        let denied = false;
        try {
          const cross = await connect(other, runtime, password);
          await cross.end();
        } catch (error) {
          if (error.code !== "42501") throw error;
          denied = true;
        }
        assert.ok(denied, `${runtime} unexpectedly connected to ${other}`);
      }
      console.log(
        `PASS: ${database} runtime TLS/login and denied access to other environment/admin database.`,
      );
    }
  } finally {
    await admin.end();
  }
}

initialize().catch((error) => {
  // Avoid printing command arguments, query text or captured secret output.
  console.error(
    `Database initialization failed at ${phase} (${error.code || error.name}). Inspect the operation without logging credentials.`,
  );
  process.exitCode = 1;
});
