import assert from "node:assert/strict";
import { after, it } from "node:test";
import { db } from "@lazuli/db";
import type { StudentCompletionInput } from "@lazuli/validators";
import { completeStudent, persistStudentCompletion } from "../../src/students/completion.js";
import { ADMIN } from "../support/finance-test-support.js";
import { cleanContractPayers, contractPayerFixture } from "../support/contract-payers.js";

const PREFIX = "P11 completion ";
void after(() => cleanContractPayers(PREFIX));

for (const mode of ["skip", "contract"] as const) {
  void it(`rolls back and safely retries the ${mode} completion, including its student and guardian`, async () => {
    const fixture = await contractPayerFixture(`${PREFIX}${mode} `);
    const { studentId: _studentId, ...terms } = fixture;
    const student = {
      fullName: `${PREFIX}${mode} beneficiary`,
      birthDate: new Date("2015-03-15T00:00:00.000Z"),
      guardian: {
        mode: "create" as const,
        input: { fullName: `${PREFIX}${mode} guardian`, phone: "11999998888" },
      },
    };
    const values: StudentCompletionInput =
      mode === "skip"
        ? { commandId: terms.commandId, student }
        : { contract: { ...terms, newStudent: student, durationMonths: 4, installmentCount: 3 } };
    await assert.rejects(
      db.$transaction(async (database) => {
        await persistStudentCompletion({ database, values, staffUserId: ADMIN.id });
        throw new Error("P11 simulated commit failure");
      }),
      /P11 simulated commit failure/u,
    );
    assert.equal(await db.student.count({ where: { commandId: terms.commandId } }), 0);
    assert.equal(await db.student.count({ where: { fullName: student.fullName } }), 0);
    assert.equal(
      await db.guardian.count({ where: { fullName: student.guardian.input.fullName } }),
      0,
    );
    assert.equal(await db.payer.count({ where: { name: terms.newPayer.name } }), 0);
    assert.equal(await db.contract.count({ where: { commandId: terms.commandId } }), 0);
    assert.equal(await db.order.count({ where: { contract: { commandId: terms.commandId } } }), 0);
    const completed = await completeStudent({ database: db, values, staffUserId: ADMIN.id });
    const replay = await completeStudent({ database: db, values, staffUserId: ADMIN.id });
    assert.equal(replay.id, completed.id);
    assert.equal(await db.student.count({ where: { fullName: student.fullName } }), 1);
    assert.equal(
      await db.guardian.count({ where: { fullName: student.guardian.input.fullName } }),
      1,
    );
    const persisted = await db.student.findUniqueOrThrow({
      where: { id: completed.id },
      include: {
        guardian: true,
        contracts: {
          include: {
            orders: { include: { installments: { orderBy: { sequenceNumber: "asc" } } } },
          },
        },
      },
    });
    assert.equal(persisted.birthDate?.toISOString(), "2015-03-15T00:00:00.000Z");
    assert.equal(persisted.guardian?.phone, "11999998888");
    assert.equal(persisted.commandId, terms.commandId);
    assert.equal(
      await db.payer.count({ where: { name: terms.newPayer.name } }),
      mode === "skip" ? 0 : 1,
    );
    if (mode === "skip") assert.deepEqual(persisted.contracts, []);
    else {
      assert.equal(persisted.contracts.length, 1);
      const contract = persisted.contracts[0];
      assert.ok(contract);
      assert.equal(contract.orders.length, 1);
      const order = contract.orders[0];
      assert.ok(order);
      assert.equal(order.principalAmountCents, 100_000);
      assert.deepEqual(
        order.installments.map((row) => row.amountCents),
        [33333, 33333, 33334],
      );
    }
    const changed: StudentCompletionInput =
      "contract" in values
        ? {
            contract: {
              ...values.contract,
              newStudent: { ...student, fullName: `${student.fullName} edited` },
            },
          }
        : { ...values, student: { ...student, fullName: `${student.fullName} edited` } };
    await assert.rejects(
      completeStudent({ database: db, values: changed, staffUserId: ADMIN.id }),
      /dados diferentes/u,
    );
    assert.equal(await db.student.count({ where: { fullName: `${student.fullName} edited` } }), 0);
  });
}
