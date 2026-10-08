import type { PaymentEntry } from "@lazuli/db";
import { createHash } from "node:crypto";
import type { PaymentOperationInput } from "@lazuli/validators";
import { lockInstallments, persistPayment, type PaymentEntrySummary } from "./payment-store.js";
import { loadSettlementItems, settlementLine, type SettlementLine } from "./settlement-data.js";
import { assertReceivablePayment, persistSettlementAdjustments } from "./settlement-write.js";
import { badRequest } from "../../trpc/errors.js";
import { sortStrings, toDateOnly, type FinanceDatabase } from "./shared.js";

type OperationContext = {
  database: FinanceDatabase;
  values: PaymentOperationInput;
  staffUserId: string;
  now: Date;
};

export async function confirmPayments(input: OperationContext): Promise<PaymentEntrySummary[]> {
  const { database, values } = input;
  const fingerprint = createHash("sha256").update(JSON.stringify(values)).digest("hex");
  // Serializes retries before checking their durable result, even when items no longer have balance.
  await database.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${values.operationId}, 0))`;
  const existing = await database.paymentEntry.findMany({
    where: { operationId: values.operationId },
  });
  if (existing.length > 0) {
    if (existing.some((entry) => entry.operationFingerprint !== fingerprint))
      throw badRequest("Operação já usada com outros dados.");
    return replayReceipts(values, existing);
  }
  const ids = values.receipts.flatMap((receipt) =>
    receipt.allocations.map((row) => row.installmentId),
  );
  if (new Set(ids).size !== ids.length)
    throw badRequest("Cada parcela deve aparecer uma única vez na operação.");
  await lockInstallments(database, sortStrings(ids));
  const lines = await validateOperation(input, ids);
  await persistSettlementAdjustments({ ...input, date: values.date, lines });
  return persistReceipts(input, fingerprint);
}

async function validateOperation(
  input: OperationContext,
  ids: string[],
): Promise<SettlementLine[]> {
  const items = await loadSettlementItems(input.database, ids);
  const lines: SettlementLine[] = [];
  for (const receipt of input.values.receipts) {
    const allocated = receipt.allocations.reduce((sum, row) => sum + row.amountCents, 0);
    if (allocated !== receipt.amountCents)
      throw badRequest("Total recebido deve coincidir com as alocações.");
    for (const allocation of receipt.allocations) {
      const item = items.find((entry) => entry.id === allocation.installmentId);
      if (!item) throw badRequest(`Parcela ${allocation.installmentId}: não encontrada.`);
      const line = settlementLine({
        item,
        date: input.values.date,
        amountCents: allocation.amountCents,
        now: input.now,
      });
      if (line.payerId !== receipt.payerId)
        throw badRequest(`Parcela ${item.id}: pertence a outro pagador.`);
      if (line.version !== allocation.version)
        throw badRequest(`Parcela ${item.id}: alterada; atualize a prévia e confira novamente.`);
      assertReceivablePayment(line);
      lines.push(line);
    }
  }
  return lines;
}

async function persistReceipts(
  input: OperationContext,
  fingerprint: string,
): Promise<PaymentEntrySummary[]> {
  const results: PaymentEntrySummary[] = [];
  for (const receipt of input.values.receipts) {
    const stored = await persistPayment({
      ...input,
      values: {
        ...receipt,
        date: toDateOnly(input.values.date),
        method: input.values.method,
        commandFingerprint: fingerprint,
      },
      allocationRows: receipt.allocations,
    });
    await input.database.paymentEntry.update({
      where: { id: stored.paymentEntry.id },
      data: {
        operationId: input.values.operationId,
        operationFingerprint: fingerprint,
      },
    });
    results.push(stored.paymentEntry);
  }
  return results;
}

function replayReceipts(
  values: PaymentOperationInput,
  stored: PaymentEntry[],
): PaymentEntrySummary[] {
  return values.receipts.map((receipt) => {
    const row = stored.find((entry) => entry.commandId === receipt.commandId);
    if (!row) throw badRequest("Operação incompleta; confira os recebimentos registrados.");
    return {
      id: row.id,
      payerId: row.payerId,
      date: row.date,
      amountCents: row.amountCents,
      method: row.method,
      note: row.note,
      externalReference: row.externalReference,
    };
  });
}
