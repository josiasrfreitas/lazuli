import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { it } from "node:test";
import pg from "pg";
import { getDatabaseUrl } from "../../src/config.js";

const migration = await readFile(
  new URL(
    "../../prisma/migrations/20260930150000_single_order_beneficiary/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

void it("enforces one active beneficiary while preserving replacements and historical students", async () => {
  const client = new pg.Client({ connectionString: getDatabaseUrl() });
  await client.connect();
  try {
    await client.query("BEGIN");
    const schema = `beneficiary_${randomUUID().replaceAll("-", "")}`;
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET LOCAL search_path TO "${schema}"`);
    await client.query(
      'CREATE TABLE "OrderBeneficiary" (order_id text, student_id text, deleted_at timestamptz)',
    );
    await client.query(migration);
    await client.query(`INSERT INTO "OrderBeneficiary" VALUES ('order', 'first', NULL)`);
    await client.query("SAVEPOINT duplicate");
    await assert.rejects(
      client.query(`INSERT INTO "OrderBeneficiary" VALUES ('order', 'second', NULL)`),
      { code: "23505", constraint: "OrderBeneficiary_one_active_per_order_key" },
    );
    await client.query("ROLLBACK TO SAVEPOINT duplicate");
    await client.query(
      `UPDATE "OrderBeneficiary" SET deleted_at = '2026-09-30' WHERE student_id = 'first'`,
    );
    await client.query(
      `INSERT INTO "OrderBeneficiary" VALUES ('order', 'second', NULL), ('other', 'first', NULL)`,
    );
    const result = await client.query(
      "SELECT student_id FROM \"OrderBeneficiary\" WHERE order_id = 'order' AND deleted_at IS NULL",
    );
    assert.deepEqual(result.rows, [{ student_id: "second" }]);
    const history = await client.query(
      "SELECT student_id FROM \"OrderBeneficiary\" WHERE order_id = 'order' ORDER BY student_id",
    );
    assert.deepEqual(history.rows, [{ student_id: "first" }, { student_id: "second" }]);
  } finally {
    await client.query("ROLLBACK");
    await client.end();
  }
});
