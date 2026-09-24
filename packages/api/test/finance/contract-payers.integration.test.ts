import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, it } from "node:test";
import { db, type Payer } from "@lazuli/db";
import { finance } from "../../src/finance/index.js";
import { ADMIN } from "../support/finance-test-support.js";
import { cleanContractPayers, contractPayerFixture } from "../support/contract-payers.js";

const PREFIX = "P06 integration ";
const INSTALLMENTS = 12;

void after(() => cleanContractPayers(PREFIX));

void it("persists typed documents and contacts, reuses a payer for siblings, and keeps homonyms distinct", async () => {
  const values = await contractPayerFixture(PREFIX);
  const first = await db.$transaction((tx) => finance(tx, ADMIN.id).createMonthlyContract(values));
  const payer = await assertCreatedPayer(first.payer.id, values.newPayer);
  const sibling = await db.student.create({
    data: { fullName: `${PREFIX}sibling`, status: "ACTIVE" },
  });
  const { newPayer: _newPayer, ...existing } = values;
  const second = await db.$transaction((tx) =>
    finance(tx, ADMIN.id).createMonthlyContract({
      ...existing,
      commandId: randomUUID(),
      studentId: sibling.id,
      payerId: payer.id,
    }),
  );
  assert.equal(second.payer.id, first.payer.id);
  assert.notEqual(second.id, first.id);
  assert.equal(second.student.id, sibling.id);
  const homonym = await db.$transaction((tx) =>
    finance(tx, ADMIN.id).createMonthlyContract({
      ...values,
      commandId: randomUUID(),
      newPayer: { name: payer.name },
    }),
  );
  assert.notEqual(homonym.payer.id, payer.id);
  const found = await finance(db, ADMIN.id).searchContractParties(payer.name);
  assert.equal(
    found.payers.find((row) => row.id === payer.id)?.detail,
    "RG 12.345.678-X · (11) 91234-5678 · maria@example.com",
  );
  assert.deepEqual(
    new Set(found.payers.map((row) => row.id)),
    new Set([payer.id, homonym.payer.id]),
  );
  const empty = await db.payer.findUniqueOrThrow({ where: { id: homonym.payer.id } });
  assert.deepEqual(
    [empty.documentType, empty.documentNumber, empty.phone, empty.email],
    [null, null, null, null],
  );
});

void it("rolls back every write and replays a committed command without another payer", async () => {
  const values = await contractPayerFixture(`${PREFIX}atomic `);
  await assert.rejects(
    db.$transaction(async (tx) => {
      await finance(tx, ADMIN.id).createMonthlyContract(values);
      throw new Error("P06 simulated commit failure");
    }),
    /P06 simulated commit failure/,
  );
  assert.equal(await db.payer.count({ where: { name: values.newPayer.name } }), 0);
  assert.equal(await db.contract.count({ where: { commandId: values.commandId } }), 0);
  assert.equal(await db.order.count({ where: { contract: { studentId: values.studentId } } }), 0);
  assert.equal(
    await db.installment.count({
      where: { createdById: ADMIN.id, order: { contract: { studentId: values.studentId } } },
    }),
    0,
  );
  const first = await db.$transaction((tx) => finance(tx, ADMIN.id).createMonthlyContract(values));
  const replay = await db.$transaction((tx) => finance(tx, ADMIN.id).createMonthlyContract(values));
  assert.equal(replay.id, first.id);
  assert.equal(replay.payer.id, first.payer.id);
  assert.equal(await db.payer.count({ where: { name: values.newPayer.name } }), 1);
  assert.equal(
    await db.installment.count({ where: { order: { contractId: first.id } } }),
    INSTALLMENTS,
  );
  await assert.rejects(
    db.$transaction((tx) =>
      finance(tx, ADMIN.id).createMonthlyContract({
        ...values,
        newPayer: { ...values.newPayer, phone: "changed" },
      }),
    ),
    /dados diferentes/,
  );
  const persisted = await db.payer.findUniqueOrThrow({ where: { id: first.payer.id } });
  assert.equal(persisted.phone, "(11) 91234-5678");
});

void it("preserves untyped taxId when reused and enforces typed new document numbers", async () => {
  const values = await contractPayerFixture(`${PREFIX}legacy `);
  const legacy = await finance(db, ADMIN.id).createPayer({
    name: `${PREFIX}legacy payer`,
    taxId: "unknown-123",
  });
  const { newPayer: _newPayer, ...existing } = values;
  const created = await db.$transaction((tx) =>
    finance(tx, ADMIN.id).createMonthlyContract({ ...existing, payerId: legacy.id }),
  );
  assert.equal(created.payer.id, legacy.id);
  const payer = await db.payer.findUniqueOrThrow({ where: { id: legacy.id } });
  assert.deepEqual(
    [payer.taxId, payer.documentType, payer.documentNumber],
    ["unknown-123", null, null],
  );
  await assert.rejects(
    db.payer.update({ where: { id: legacy.id }, data: { documentNumber: "123" } }),
    /Payer_document_number_requires_type/,
  );
});

async function assertCreatedPayer(
  id: string,
  expected: Awaited<ReturnType<typeof contractPayerFixture>>["newPayer"],
): Promise<Payer> {
  const payer = await db.payer.findUniqueOrThrow({ where: { id: id } });
  assert.deepEqual(
    {
      name: payer.name,
      documentType: payer.documentType,
      documentNumber: payer.documentNumber,
      phone: payer.phone,
      email: payer.email,
    },
    expected,
  );
  assert.equal(payer.taxId, null);
  assert.equal(payer.createdById, ADMIN.id);
  assert.equal(payer.updatedById, ADMIN.id);
  return payer;
}
