import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db, type PaymentEntry } from "@lazuli/db";
import type { PaymentOperationInput } from "@lazuli/validators";
import { finance } from "../../src/finance/index.js";
import { contractPayerFixture, cleanContractPayers } from "./contract-payers.js";
import { ADMIN } from "./finance-test-support.js";

export const PAYMENT_NOW = new Date("2026-09-30T12:00:00Z");
export async function paymentFixture(
  prefix: string,
): Promise<{ installmentId: string; payerId: string; contractId: string }> {
  const values = await contractPayerFixture(prefix);
  const contract = await db.$transaction((tx) =>
    finance(tx, ADMIN.id).createMonthlyContract({
      ...values,
      durationMonths: 4,
      installmentCount: 1,
      firstDueDate: "2026-01-31",
    }),
  );
  const installment = await db.installment.findFirstOrThrow({
    where: { order: { contractId: contract.id } },
  });
  return { installmentId: installment.id, payerId: contract.payer.id, contractId: contract.id };
}
export async function paymentCommand(input: {
  installmentId: string;
  payerId: string;
  date: string;
  amountCents?: number;
}): Promise<PaymentOperationInput> {
  const rows = await finance(db, ADMIN.id).previewPayments(
    {
      date: input.date,
      items: [
        {
          installmentId: input.installmentId,
          ...(input.amountCents === undefined ? {} : { amountCents: input.amountCents }),
        },
      ],
    },
    PAYMENT_NOW,
  );
  const line = rows[0]?.line;
  assert.ok(line, rows[0]?.error ?? "Missing quote");
  return {
    operationId: randomUUID(),
    date: input.date,
    method: "PIX",
    receipts: [
      {
        commandId: randomUUID(),
        payerId: input.payerId,
        amountCents: line.quote.receivedCents,
        allocations: [
          {
            installmentId: input.installmentId,
            amountCents: line.quote.receivedCents,
            version: line.version,
          },
        ],
      },
    ],
  };
}
export async function confirmPaymentCommand(
  values: PaymentOperationInput,
): Promise<
  Pick<
    PaymentEntry,
    "id" | "payerId" | "date" | "amountCents" | "method" | "note" | "externalReference"
  >[]
> {
  return db.$transaction((tx) => finance(tx, ADMIN.id).confirmPayments(values, PAYMENT_NOW));
}
export async function cleanPaymentOperations(prefix: string): Promise<void> {
  const payer = { name: { startsWith: prefix } };
  await db.paymentAllocation.deleteMany({ where: { paymentEntry: { payer } } });
  await db.paymentEntry.deleteMany({ where: { payer } });
  await db.installmentAdjustment.deleteMany({
    where: { installment: { order: { contract: { payer } } } },
  });
  await cleanContractPayers(prefix);
}
