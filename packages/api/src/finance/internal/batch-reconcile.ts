import type { financeBatchReconcileInputSchema, z } from "@lazuli/validators";

import {
  calculateRemainingBalanceCents,
  loadInstallments,
  lockInstallments,
  persistPayment,
  type LoadedInstallment,
  type PaymentAllocationSummary,
  type PaymentEntrySummary,
} from "./payment-store.js";
import { sortStrings, type ReceivablesDatabase } from "./shared.js";

export type BatchReconcileInput = z.infer<typeof financeBatchReconcileInputSchema>;

type BatchReconcileRowStatus = "APPLIED" | "REJECTED" | "SKIPPED";

type BatchReconcileRow = {
  installmentId: string;
  status: BatchReconcileRowStatus;
  reason: string | null;
  payerId: string | null;
  amountCents: number | null;
  paymentEntryId: string | null;
  allocationId: string | null;
};

type ValidBatchRow = {
  inputIndex: number;
  installmentId: string;
  payerId: string;
  amountCents: number;
};

type InvalidBatchRow = {
  inputIndex: number;
  installmentId: string;
  reason: string;
  payerId: string | null;
  amountCents: number | null;
};

type BatchRowValidation =
  | { status: "valid"; row: ValidBatchRow }
  | { status: "invalid"; row: InvalidBatchRow };

type PersistedPayerPayment = {
  paymentEntry: PaymentEntrySummary;
  allocations: PaymentAllocationSummary[];
  payerRows: ValidBatchRow[];
};

export type BatchReconcileResult = {
  ok: boolean;
  paymentEntries: PaymentEntrySummary[];
  allocations: PaymentAllocationSummary[];
  rows: BatchReconcileRow[];
};

const DUPLICATE_INSTALLMENT_REASON = "Parcela selecionada mais de uma vez.";
const MISSING_INSTALLMENT_REASON = "Parcela nao encontrada.";
const WAIVED_INSTALLMENT_REASON = "Parcela isenta nao aceita reconciliacao.";
const NON_POSITIVE_REMAINING_REASON = "Parcela nao possui saldo restante positivo.";
const BATCH_REJECTED_REASON = "Lote rejeitado por outra parcela invalida.";

export async function batchReconcile(input: {
  database: ReceivablesDatabase;
  values: BatchReconcileInput;
  staffUserId: string;
}): Promise<BatchReconcileResult> {
  const validation = await validateBatch(input.database, input.values.installmentIds);

  if (validation.invalidRows.length > 0) {
    return buildRejectedResult({
      installmentIds: input.values.installmentIds,
      validRows: validation.validRows,
      invalidRows: validation.invalidRows,
    });
  }

  return applyValidBatch({
    database: input.database,
    values: input.values,
    staffUserId: input.staffUserId,
    validRows: validation.validRows,
  });
}

async function validateBatch(
  database: ReceivablesDatabase,
  installmentIds: string[],
): Promise<{ validRows: ValidBatchRow[]; invalidRows: InvalidBatchRow[] }> {
  const uniqueInstallmentIds = sortStrings([...new Set(installmentIds)]);
  await lockInstallments(database, uniqueInstallmentIds);

  const installments = await loadInstallments(database, uniqueInstallmentIds);
  const installmentsById = new Map(
    installments.map((installment) => [installment.id, installment]),
  );
  const duplicateInstallmentIds = findDuplicateIds(installmentIds);

  return validateRows({
    installmentIds,
    installmentsById,
    duplicateInstallmentIds,
  });
}

async function applyValidBatch(input: {
  database: ReceivablesDatabase;
  values: BatchReconcileInput;
  staffUserId: string;
  validRows: ValidBatchRow[];
}): Promise<BatchReconcileResult> {
  const payerIds = sortStrings([...new Set(input.validRows.map((row) => row.payerId))]);
  const rowsByInputIndex = new Map<number, BatchReconcileRow>();
  const paymentEntries: PaymentEntrySummary[] = [];
  const allocations: PaymentAllocationSummary[] = [];

  for (const payerId of payerIds) {
    const persisted = await persistPayerPayment({
      ...input,
      payerId,
    });
    paymentEntries.push(persisted.paymentEntry);
    allocations.push(...persisted.allocations);
    indexAppliedRows(rowsByInputIndex, persisted);
  }

  return {
    ok: true,
    paymentEntries,
    allocations,
    rows: input.values.installmentIds.map(
      (_installmentId, index) => rowsByInputIndex.get(index) ?? missingAppliedRow(index),
    ),
  };
}

async function persistPayerPayment(input: {
  database: ReceivablesDatabase;
  values: BatchReconcileInput;
  staffUserId: string;
  validRows: ValidBatchRow[];
  payerId: string;
}): Promise<PersistedPayerPayment> {
  const payerRows = input.validRows.filter((row) => row.payerId === input.payerId);
  const amountCents = payerRows.reduce((total, row) => total + row.amountCents, 0);
  const persisted = await persistPayment({
    database: input.database,
    values: {
      payerId: input.payerId,
      date: input.values.date,
      amountCents,
      method: input.values.method,
      externalReference: input.values.externalReference ?? null,
    },
    allocationRows: payerRows.map((row) => ({
      installmentId: row.installmentId,
      amountCents: row.amountCents,
    })),
    staffUserId: input.staffUserId,
  });

  return { ...persisted, payerRows };
}

function indexAppliedRows(
  rowsByInputIndex: Map<number, BatchReconcileRow>,
  persisted: PersistedPayerPayment,
): void {
  const allocationsByInstallmentId = new Map(
    persisted.allocations.map((allocation) => [allocation.installmentId, allocation]),
  );

  for (const row of persisted.payerRows) {
    const allocation = allocationsByInstallmentId.get(row.installmentId);
    rowsByInputIndex.set(row.inputIndex, {
      installmentId: row.installmentId,
      status: "APPLIED",
      reason: null,
      payerId: row.payerId,
      amountCents: row.amountCents,
      paymentEntryId: persisted.paymentEntry.id,
      allocationId: allocation?.id ?? null,
    });
  }
}

function buildRejectedResult(input: {
  installmentIds: string[];
  validRows: ValidBatchRow[];
  invalidRows: InvalidBatchRow[];
}): BatchReconcileResult {
  return {
    ok: false,
    paymentEntries: [],
    allocations: [],
    rows: buildRejectedRows(input),
  };
}

function validateRows(input: {
  installmentIds: string[];
  installmentsById: Map<string, LoadedInstallment>;
  duplicateInstallmentIds: Set<string>;
}): { validRows: ValidBatchRow[]; invalidRows: InvalidBatchRow[] } {
  const validRows: ValidBatchRow[] = [];
  const invalidRows: InvalidBatchRow[] = [];

  for (const [inputIndex, installmentId] of input.installmentIds.entries()) {
    const validation = validateRow({
      inputIndex,
      installmentId,
      installment: input.installmentsById.get(installmentId),
      isDuplicate: input.duplicateInstallmentIds.has(installmentId),
    });

    if (validation.status === "valid") {
      validRows.push(validation.row);
      continue;
    }

    invalidRows.push(validation.row);
  }

  return { validRows, invalidRows };
}

function validateRow(input: {
  inputIndex: number;
  installmentId: string;
  installment: LoadedInstallment | undefined;
  isDuplicate: boolean;
}): BatchRowValidation {
  if (input.isDuplicate) {
    return invalidValidation({ ...input, reason: DUPLICATE_INSTALLMENT_REASON });
  }

  if (input.installment === undefined) {
    return invalidValidation({ ...input, reason: MISSING_INSTALLMENT_REASON });
  }

  const amountCents = calculateRemainingBalanceCents(input.installment);

  if (input.installment.waivedAt !== null) {
    return invalidValidation({ ...input, reason: WAIVED_INSTALLMENT_REASON, amountCents });
  }

  if (amountCents <= 0) {
    return invalidValidation({
      ...input,
      reason: NON_POSITIVE_REMAINING_REASON,
      amountCents,
    });
  }

  return {
    status: "valid",
    row: {
      inputIndex: input.inputIndex,
      installmentId: input.installmentId,
      payerId: input.installment.order.payerId,
      amountCents,
    },
  };
}

function invalidValidation(input: {
  inputIndex: number;
  installmentId: string;
  installment: LoadedInstallment | undefined;
  reason: string;
  amountCents?: number | null;
}): BatchRowValidation {
  const amountCents =
    input.amountCents ??
    (input.installment === undefined ? null : calculateRemainingBalanceCents(input.installment));

  return {
    status: "invalid",
    row: {
      inputIndex: input.inputIndex,
      installmentId: input.installmentId,
      reason: input.reason,
      payerId: input.installment?.order.payerId ?? null,
      amountCents,
    },
  };
}

function buildRejectedRows(input: {
  installmentIds: string[];
  validRows: ValidBatchRow[];
  invalidRows: InvalidBatchRow[];
}): BatchReconcileRow[] {
  const validRowsByInputIndex = new Map(input.validRows.map((row) => [row.inputIndex, row]));
  const invalidRowsByInputIndex = new Map(input.invalidRows.map((row) => [row.inputIndex, row]));

  return input.installmentIds.map((installmentId, inputIndex) => {
    const invalidRow = invalidRowsByInputIndex.get(inputIndex);
    if (invalidRow !== undefined) {
      return {
        installmentId,
        status: "REJECTED",
        reason: invalidRow.reason,
        payerId: invalidRow.payerId,
        amountCents: invalidRow.amountCents,
        paymentEntryId: null,
        allocationId: null,
      };
    }

    const validRow = validRowsByInputIndex.get(inputIndex);
    return {
      installmentId,
      status: "SKIPPED",
      reason: BATCH_REJECTED_REASON,
      payerId: validRow?.payerId ?? null,
      amountCents: validRow?.amountCents ?? null,
      paymentEntryId: null,
      allocationId: null,
    };
  });
}

function findDuplicateIds(values: string[]): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
      continue;
    }

    seen.add(value);
  }

  return duplicates;
}

function missingAppliedRow(inputIndex: number): BatchReconcileRow {
  throw new Error(`Missing applied batch reconcile row at index ${inputIndex}.`);
}
