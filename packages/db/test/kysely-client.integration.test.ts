import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { db } from "../src/index.js";

const PREFIX = "Kysely integration ";

void describe("Prisma-backed Kysely client", { concurrency: 1 }, () => {
  void before(async () => {
    await db.$connect();
    await clean();
  });

  void after(async () => {
    await clean();
    await db.$disconnect();
  });

  registerSharedTransactionReadTest();
  registerRollbackTest();
  registerSoftDeleteTest();
});

function registerSharedTransactionReadTest(): void {
  void it("reads an uncommitted Prisma write through Kysely in the same transaction", async () => {
    const payerId = await db.$transaction(async (transaction) => {
      const payer = await transaction.payer.create({ data: { name: `${PREFIX}visible` } });
      const rows = await transaction.$kysely
        .selectFrom("Payer")
        .select("id")
        .where("id", "=", payer.id)
        .execute();

      assert.deepEqual(rows, [{ id: payer.id }]);
      return payer.id;
    });

    const committed = await db.$kysely
      .selectFrom("Payer")
      .select("id")
      .where("id", "=", payerId)
      .executeTakeFirst();
    assert.deepEqual(committed, { id: payerId });
  });
}

function registerRollbackTest(): void {
  void it("rolls back Prisma writes after a Kysely read", async () => {
    let payerId = "";
    const rollback = new Error("rollback test");

    const operation = db.$transaction(async (transaction) => {
      const payer = await transaction.payer.create({ data: { name: `${PREFIX}rollback` } });
      payerId = payer.id;
      const visible = await transaction.$kysely
        .selectFrom("Payer")
        .select((expressions) => expressions.fn.countAll<number>().as("count"))
        .where("id", "=", payer.id)
        .executeTakeFirstOrThrow();
      assert.equal(Number(visible.count), 1);
      throw rollback;
    });

    await assert.rejects(operation, rollback);

    assert.equal(await db.payer.count({ where: { id: payerId } }), 0);
  });
}

function registerSoftDeleteTest(): void {
  void it("keeps Prisma soft-delete filtering on the extended client", async () => {
    const payer = await db.payer.create({ data: { name: `${PREFIX}soft-delete` } });
    await db.payer.update({ where: { id: payer.id }, data: { deletedAt: new Date() } });

    assert.equal(await db.payer.findUnique({ where: { id: payer.id } }), null);
  });
}

async function clean(): Promise<void> {
  await db.$executeRaw`delete from "Payer" where name like ${`${PREFIX}%`}`;
}
