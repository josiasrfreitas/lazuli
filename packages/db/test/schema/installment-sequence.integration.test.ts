import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { it } from "node:test";
import pg from "pg";
import { getDatabaseUrl } from "../../src/config.js";

const migration = await readFile(
  new URL(
    "../../prisma/migrations/20260910231021_installment_sequence_number/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

for (const populated of [false, true]) {
  void it(`migrates the previous installment table (${populated ? "populated" : "empty"})`, async () => {
    const client = new pg.Client({ connectionString: getDatabaseUrl() });
    await client.connect();
    try {
      await client.query("BEGIN");
      const schema = `sequence_${randomUUID().replaceAll("-", "")}`;
      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`SET LOCAL search_path TO "${schema}"`);
      await client.query(`CREATE TABLE "Installment" (
        id text PRIMARY KEY, order_id text NOT NULL, due_date date NOT NULL, deleted_at timestamptz
      )`);
      if (populated) {
        await client.query(`INSERT INTO "Installment" VALUES
          ('c', 'first', '2026-02-05', NULL),
          ('b', 'first', '2026-01-05', NULL),
          ('a', 'first', '2026-01-05', '2026-01-06'),
          ('d', 'second', '2026-03-05', NULL)`);
      }
      await client.query(migration);
      const result = await client.query(
        'SELECT id, sequence_number FROM "Installment" ORDER BY id',
      );
      assert.deepEqual(
        result.rows,
        populated
          ? [
              { id: "a", sequence_number: 1 },
              { id: "b", sequence_number: 2 },
              { id: "c", sequence_number: 3 },
              { id: "d", sequence_number: 1 },
            ]
          : [],
      );
      await assertSequenceConstraints(client, populated);
    } finally {
      await client.query("ROLLBACK");
      await client.end();
    }
  });
}

void it("enforces active installment sequence uniqueness in the migrated database", async () => {
  const { createDbClient } = await import("../../src/client.js");
  const database = createDbClient();
  const payer = await database.payer.create({ data: { name: "Sequence constraint fixture" } });
  try {
    const data = {
      payerId: payer.id,
      kind: "OTHER" as const,
      principalAmountCents: 1000,
      startDate: new Date("2026-01-01"),
      dueDay: 5,
    };
    const firstOrder = await database.order.create({ data });
    const secondOrder = await database.order.create({ data });
    const installment = {
      orderId: firstOrder.id,
      amountCents: 1000,
      dueDate: new Date("2026-01-05"),
      sequenceNumber: 1,
    };
    const first = await database.installment.create({ data: installment });
    await assert.rejects(database.installment.create({ data: installment }), { code: "P2002" });
    await database.installment.update({ where: { id: first.id }, data: { deletedAt: new Date() } });
    const replacement = await database.installment.create({ data: installment });
    const other = await database.installment.create({
      data: { ...installment, orderId: secondOrder.id },
    });
    assert.equal(replacement.sequenceNumber, 1);
    assert.equal(other.sequenceNumber, 1);
    assert.equal(await database.installment.count({ where: { order: { payerId: payer.id } } }), 2);
  } finally {
    await database.installment.deleteMany({ where: { order: { payerId: payer.id } } });
    await database.order.deleteMany({ where: { payerId: payer.id } });
    await database.payer.delete({ where: { id: payer.id } });
    await database.$disconnect();
  }
});

async function assertSequenceConstraints(client: pg.Client, populated: boolean): Promise<void> {
  await client.query(
    `INSERT INTO "Installment" VALUES ('new', 'new-order', '2026-01-05', NULL, 1)`,
  );
  await client.query("SAVEPOINT missing_number");
  await assert.rejects(
    client.query(`INSERT INTO "Installment" (id, order_id, due_date)
        VALUES ('missing', 'new-order', '2026-02-05')`),
    { code: "23502" },
  );
  await client.query("ROLLBACK TO SAVEPOINT missing_number");
  await client.query("SAVEPOINT duplicate_number");
  await assert.rejects(
    client.query(`INSERT INTO "Installment" VALUES
        ('duplicate', 'new-order', '2026-02-05', NULL, 1)`),
    { code: "23505" },
  );
  await client.query("ROLLBACK TO SAVEPOINT duplicate_number");
  await client.query(`UPDATE "Installment" SET deleted_at = now() WHERE id = 'new'`);
  await client.query(`INSERT INTO "Installment" VALUES
        ('replacement', 'new-order', '2026-02-05', NULL, 1),
        ('other', 'other-order', '2026-02-05', NULL, 1)`);
  const active = await client.query(`SELECT id FROM "Installment"
        WHERE sequence_number = 1 AND deleted_at IS NULL ORDER BY id`);
  assert.deepEqual(
    active.rows,
    populated
      ? [{ id: "d" }, { id: "other" }, { id: "replacement" }]
      : [{ id: "other" }, { id: "replacement" }],
  );
}
