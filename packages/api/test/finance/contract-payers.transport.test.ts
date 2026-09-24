import assert from "node:assert/strict";
import { after, it } from "node:test";
import { db } from "@lazuli/db";
import { ADMIN, callHttpMutation, callHttpQuery } from "../support/finance-test-support.js";
import { cleanContractPayers, contractPayerFixture } from "../support/contract-payers.js";

const PREFIX = "P06 transport ";
const CREATE_PATH = "finance.createMonthlyContract";
const OK = 200;
const UNAUTHORIZED = 401;
const FORBIDDEN = 403;
const CONFLICT = 409;
const INSTALLMENTS = 12;
type ContractResponse = { result: { data: { json: { id: string; payer: { id: string } } } } };

void after(() => cleanContractPayers(PREFIX));
void it("recovers concurrent submissions and exposes the single contract in the list", async () => {
  const body = await contractPayerFixture(PREFIX);
  const responses = await Promise.all([
    callHttpMutation({ path: CREATE_PATH, body }),
    callHttpMutation({ path: CREATE_PATH, body }),
  ]);
  assert.deepEqual(
    responses.map((response) => response.status),
    [OK, OK],
  );
  const results = await Promise.all(
    responses.map(async (response) => (await response.json()) as ContractResponse),
  );
  const first = results[0]!.result.data.json;
  assert.deepEqual(results[1]!.result.data.json, first);
  assert.equal(await db.payer.count({ where: { name: body.newPayer.name } }), 1);
  assert.equal(await db.contract.count({ where: { commandId: body.commandId } }), 1);
  assert.equal(await db.order.count({ where: { contractId: first.id } }), 1);
  assert.equal(
    await db.installment.count({ where: { order: { contractId: first.id } } }),
    INSTALLMENTS,
  );
  const listResponse = await callHttpQuery({
    path: "finance.listContracts",
    body: { query: PREFIX },
  });
  const list = (await listResponse.json()) as {
    result: { data: { json: { rows: Array<{ id: string }> } } };
  };
  assert.equal(listResponse.status, OK);
  assert.deepEqual(
    list.result.data.json.rows.map((row) => row.id),
    [first.id],
  );
  const conflict = await callHttpMutation({
    path: CREATE_PATH,
    body: { ...body, newPayer: { ...body.newPayer, documentType: "CPF" } },
  });
  assert.equal(conflict.status, CONFLICT);
  assert.match(await conflict.text(), /dados diferentes/);
});

for (const [label, staffUser, status] of [
  ["anonymous", null, UNAUTHORIZED],
  ["teacher", { ...ADMIN, role: "TEACHER" as const }, FORBIDDEN],
] as const) {
  void it(`rejects ${label} creation without storing a payer`, async () => {
    const body = await contractPayerFixture(`${PREFIX}${label} `);
    const response = await callHttpMutation({
      path: CREATE_PATH,
      body,
      staffUser,
    });
    assert.equal(response.status, status);
    const error = (await response.json()) as { error: { json: { data: { code: string } } } };
    assert.equal(error.error.json.data.code, label === "anonymous" ? "UNAUTHORIZED" : "FORBIDDEN");
    assert.equal(await db.payer.count({ where: { name: body.newPayer.name } }), 0);
    assert.equal(await db.contract.count({ where: { commandId: body.commandId } }), 0);
  });
}
