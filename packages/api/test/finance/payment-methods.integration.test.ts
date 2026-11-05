import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, it } from "node:test";
import { db } from "@lazuli/db";
import { caller, ensureAdminUser } from "../support/finance-test-support.js";
import {
  paymentFixture,
  paymentCommand,
  confirmPaymentCommand,
  cleanPaymentOperations,
} from "../support/payment-operation.js";

const PREFIX = "Payment method catalog integration ";
const createdCodes: string[] = [];
const createdNames: string[] = [];
void before(ensureAdminUser);
void after(async () => {
  await cleanPaymentOperations(PREFIX);
  await db.activityEvent.deleteMany({
    where: {
      action: "finance.createPaymentMethod",
      description: {
        in: createdNames.flatMap((name) => [`${name} cadastrada.`, `${name} reativada.`]),
      },
    },
  });
  await db.paymentMethod.deleteMany({ where: { code: { in: createdCodes } } });
});

async function createMethod(): Promise<string> {
  const code = `TEST_${randomUUID().replaceAll("-", "").toUpperCase()}`;
  await db.paymentMethod.create({ data: { code, name: "Método de teste" } });
  createdCodes.push(code);
  return code;
}

void it("accepts catalog entries without enum changes and preserves replay after deactivation", async () => {
  const method = await createMethod();
  const item = await paymentFixture(PREFIX);
  const command = { ...(await paymentCommand({ ...item, date: "2026-01-31" })), method };
  const first = await confirmPaymentCommand(command);
  assert.equal(first[0]?.method, method);
  const stored = await db.paymentEntry.findUniqueOrThrow({
    where: { id: first[0].id },
    include: { paymentMethod: true },
  });
  assert.equal(stored.paymentMethod.name, "Método de teste");
  await db.paymentMethod.update({ where: { code: method }, data: { active: false } });
  const replay = await confirmPaymentCommand(command);
  assert.equal(replay[0]?.id, first[0]?.id);
});

void it("rejects unknown, inactive and soft-deleted methods without financial writes", async () => {
  const method = await createMethod();
  const item = await paymentFixture(PREFIX);
  const command = await paymentCommand({ ...item, date: "2026-02-10" });
  await assert.rejects(
    confirmPaymentCommand({ ...command, method: "NONEXISTENT_METHOD" }),
    /forma de pagamento disponível/u,
  );
  await db.paymentMethod.update({ where: { code: method }, data: { active: false } });
  await assert.rejects(
    confirmPaymentCommand({ ...command, method }),
    /forma de pagamento disponível/u,
  );
  await db.paymentMethod.update({
    where: { code: method },
    data: { active: true, deletedAt: new Date() },
  });
  await assert.rejects(
    confirmPaymentCommand({ ...command, method }),
    /forma de pagamento disponível/u,
  );
  assert.equal(await db.paymentEntry.count({ where: { operationId: command.operationId } }), 0);
  assert.equal(
    await db.installmentAdjustment.count({ where: { installmentId: item.installmentId } }),
    0,
  );
});

void it("adds a named method and reuses the catalog entry", async () => {
  const suffix = randomUUID().slice(0, 8);
  const name = `Transferência especial ${suffix}`;
  const created = await caller().finance.createPaymentMethod({
    name: `transferência especial ${suffix}`,
  });
  createdCodes.push(created.code);
  createdNames.push(name);
  assert.equal(created.name, name);
  assert.match(created.code, /^CUSTOM_[A-Z0-9_]+$/u);
  assert.equal(created.allowsExternalInstallments, false);
  const available = await caller().finance.paymentMethods();
  assert.ok(available.some((item) => item.code === created.code));

  const reused = await caller().finance.createPaymentMethod({
    name: name.toLocaleUpperCase("pt-BR"),
  });
  assert.equal(reused.code, created.code);
  assert.equal(await db.paymentMethod.count({ where: { code: created.code } }), 1);

  await db.paymentMethod.update({ where: { code: created.code }, data: { active: false } });
  const restored = await caller().finance.createPaymentMethod({ name });
  assert.equal(restored.code, created.code);
  const restoredCatalog = await caller().finance.paymentMethods();
  assert.ok(restoredCatalog.some((method) => method.code === created.code));
});
