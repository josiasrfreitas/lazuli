const POSTGRES_CONTAINER = "lazuli-postgres";
const INITIALIZATION_TABLE = '"lazuli_local"."workspace_initializations"';

function psqlCommand(database, command) {
  return ["exec", POSTGRES_CONTAINER, "psql", "-U", "lazuli", "-d", database, ...command];
}

export function databaseInitializationCompleted({ database, initializationKey, root, run }) {
  const result = run({
    command: "docker",
    arguments_: psqlCommand(database, [
      "-tAc",
      `SELECT 1 FROM ${INITIALIZATION_TABLE} WHERE key = '${initializationKey}'`,
    ]),
    root,
    capture: true,
    capability: "database initialization inspection",
  });
  return result.trim() === "1";
}

export function provisionDatabaseInitializationStore({ database, root, run }) {
  run({
    command: "docker",
    arguments_: psqlCommand(database, [
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `CREATE SCHEMA IF NOT EXISTS lazuli_local; CREATE TABLE IF NOT EXISTS ${INITIALIZATION_TABLE} (key text PRIMARY KEY, completed_at timestamptz NOT NULL DEFAULT NOW())`,
    ]),
    root,
    capability: "local database initialization store provisioning",
  });
}
