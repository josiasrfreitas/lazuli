import assert from "node:assert/strict";
import { after, it } from "node:test";
import { randomUUID } from "node:crypto";
import { db } from "@lazuli/db";
import { callHttpMutation, callHttpQuery } from "../support/finance-test-support.js";
import { cleanContractPayers, contractPayerFixture } from "../support/contract-payers.js";

const PREFIX = "P11 transport ";
type CompletedStudent = {
  result: {
    data: {
      json: { id: string };
    };
  };
};
void after(() => cleanContractPayers(PREFIX));

void it("creates only the student when finance is skipped", async () => {
  await contractPayerFixture(`${PREFIX}setup `);
  const name = `${PREFIX}skip student`;
  const command = { commandId: randomUUID(), student: { fullName: name } };
  const responses = await Promise.all([
    callHttpMutation({ path: "students.completeCreation", body: command }),
    callHttpMutation({ path: "students.completeCreation", body: command }),
  ]);
  const response = responses[0];
  const body = (await response.json()) as { result: { data: { json: { id: string } } } };
  assert.equal(response.status, 200);
  assert.equal(responses[1].status, 200);
  assert.deepEqual(await responses[1].json(), body);
  const persisted = await db.student.findUniqueOrThrow({
    where: { id: body.result.data.json.id },
    include: { contracts: true, enrollments: true },
  });
  assert.equal(persisted.fullName, name);
  assert.deepEqual(persisted.contracts, []);
  assert.deepEqual(persisted.enrollments, []);
  assert.equal(await db.payer.count({ where: { name } }), 0);
  assert.equal(await db.student.count({ where: { fullName: name } }), 1);
  const conflict = await callHttpMutation({
    path: "students.completeCreation",
    body: { ...command, student: { fullName: `${name} edited` } },
  });
  assert.equal(conflict.status, 409);
  assert.match(await conflict.text(), /dados diferentes/u);
});

void it("recovers concurrent completion with one new student and one financial set", async () => {
  const fixture = await contractPayerFixture(`${PREFIX}complete `);
  const { studentId: _studentId, ...terms } = fixture;
  const body = {
    ...terms,
    installmentCount: 3,
    newStudent: {
      fullName: `${PREFIX}complete beneficiary`,
      guardian: {
        mode: "create",
        input: { fullName: `${PREFIX}complete guardian`, phone: "11999998888" },
      },
    },
  };
  const responses = await Promise.all([
    callHttpMutation({ path: "students.completeCreation", body: { contract: body } }),
    callHttpMutation({ path: "students.completeCreation", body: { contract: body } }),
  ]);
  assert.deepEqual(
    responses.map((response) => response.status),
    [200, 200],
  );
  const results = await Promise.all(
    responses.map(async (response) => (await response.json()) as CompletedStudent),
  );
  const completed = results[0]!.result.data.json;
  assert.deepEqual(results[1]!.result.data.json, completed);
  const created = await db.contract.findUniqueOrThrow({
    where: { commandId: body.commandId },
    include: { student: true, payer: true },
  });
  assert.equal(created.student.id, completed.id);
  assert.equal(created.student.fullName, body.newStudent.fullName);
  assert.equal(await db.student.count({ where: { fullName: body.newStudent.fullName } }), 1);
  assert.equal(
    await db.guardian.count({ where: { fullName: body.newStudent.guardian.input.fullName } }),
    1,
  );
  assert.equal(await db.payer.count({ where: { name: body.newPayer.name } }), 1);
  assert.equal(await db.contract.count({ where: { commandId: body.commandId } }), 1);
  const orders = await db.order.findMany({
    where: { contractId: created.id },
    include: { installments: { orderBy: { sequenceNumber: "asc" } } },
  });
  assert.equal(orders.length, 1);
  assert.equal(orders[0]?.principalAmountCents, 300_000);
  assert.deepEqual(
    orders[0]?.installments.map((row) => row.amountCents),
    [100_000, 100_000, 100_000],
  );
  const previewResponse = await callHttpQuery({
    path: "students.preview",
    body: { id: created.student.id },
  });
  const preview = (await previewResponse.json()) as {
    result: { data: { json: { id: string; fullName: string } } };
  };
  assert.equal(previewResponse.status, 200);
  assert.equal(preview.result.data.json.id, created.student.id);
  assert.equal(preview.result.data.json.fullName, body.newStudent.fullName);
});

void it("rejects unauthorized completion before creating any student or payer", async () => {
  const fixture = await contractPayerFixture(`${PREFIX}unauthorized `);
  const { studentId: _studentId, ...terms } = fixture;
  const body = { ...terms, newStudent: { fullName: `${PREFIX}unauthorized beneficiary` } };
  const response = await callHttpMutation({
    path: "students.completeCreation",
    body: { contract: body },
    staffUser: null,
  });
  assert.equal(response.status, 401);
  const error = (await response.json()) as { error: { json: { data: { code: string } } } };
  assert.equal(error.error.json.data.code, "UNAUTHORIZED");
  assert.equal(await db.student.count({ where: { fullName: body.newStudent.fullName } }), 0);
  assert.equal(await db.payer.count({ where: { name: body.newPayer.name } }), 0);
});

for (const first of ["contract", "student"] as const) {
  void it(`rejects cross-endpoint command reuse after ${first} creation and preserves its replay`, async () => {
    const contract = await contractPayerFixture(`${PREFIX}ownership ${first} `);
    const student = {
      commandId: contract.commandId,
      student: { fullName: `${PREFIX}ownership ${first} beneficiary` },
    };
    const requests = {
      contract: { path: "finance.createMonthlyContract", body: contract },
      student: { path: "students.completeCreation", body: student },
    };
    const original = await callHttpMutation(requests[first]);
    assert.equal(original.status, 200);
    const other = first === "contract" ? "student" : "contract";
    const conflict = await callHttpMutation(requests[other]);
    assert.equal(conflict.status, 409);
    assert.match(await conflict.text(), /outra operação/u);
    const replay = await callHttpMutation(requests[first]);
    assert.equal(replay.status, 200);
    assert.deepEqual(await replay.json(), await original.json());
    assert.equal(
      await db.student.count({ where: { fullName: student.student.fullName } }),
      first === "student" ? 1 : 0,
    );
    assert.equal(
      await db.contract.count({ where: { commandId: contract.commandId } }),
      first === "contract" ? 1 : 0,
    );
    assert.equal(
      await db.payer.count({ where: { name: contract.newPayer.name } }),
      first === "contract" ? 1 : 0,
    );
  });
}

void it("rejects direct contract replay of a command owned by the completed wizard", async () => {
  const { studentId: _studentId, ...terms } = await contractPayerFixture(`${PREFIX}wizard owner `);
  const contract = { ...terms, newStudent: { fullName: `${PREFIX}wizard owner beneficiary` } };
  const request = { path: "students.completeCreation", body: { contract } };
  const original = await callHttpMutation(request);
  assert.equal(original.status, 200);
  const conflict = await callHttpMutation({
    path: "finance.createMonthlyContract",
    body: contract,
  });
  assert.equal(conflict.status, 409);
  assert.match(await conflict.text(), /outra operação/u);
  const replay = await callHttpMutation(request);
  assert.equal(replay.status, 200);
  assert.deepEqual(await replay.json(), await original.json());
  assert.equal(await db.contract.count({ where: { commandId: contract.commandId } }), 1);
  assert.equal(await db.student.count({ where: { fullName: contract.newStudent.fullName } }), 1);
});

void it("allows exactly one owner when student and contract endpoints race for the same command", async () => {
  const contract = await contractPayerFixture(`${PREFIX}racing owner `);
  const student = {
    commandId: contract.commandId,
    student: { fullName: `${PREFIX}racing owner beneficiary` },
  };
  const responses = await Promise.all([
    callHttpMutation({
      path: "finance.createMonthlyContract",
      body: { ...contract, commandId: contract.commandId.toUpperCase() },
    }),
    callHttpMutation({ path: "students.completeCreation", body: student }),
  ]);
  assert.deepEqual(new Set(responses.map((response) => response.status)), new Set([200, 409]));
  const students = await db.student.count({ where: { commandId: contract.commandId } });
  const contracts = await db.contract.count({ where: { commandId: contract.commandId } });
  assert.equal(students + contracts, 1);
  assert.equal(await db.payer.count({ where: { name: contract.newPayer.name } }), contracts);
  assert.equal(await db.student.count({ where: { fullName: student.student.fullName } }), students);
});
