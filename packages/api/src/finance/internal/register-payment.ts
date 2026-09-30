import { createHash } from "node:crypto";

import { prepareContractPayment } from "./contract-payment.js";
import { persistSettlementAdjustments } from "./settlement-write.js";
import type { financeRegisterPaymentInputSchema, z } from "@lazuli/validators";

import {
  calculateRemainingBalanceCents,
  loadInstallments,
  lockInstallments,
  persistPayment,
  type LoadedInstallment,
  type PaymentAllocationInput,
  type PaymentAllocationSummary,
  type PaymentEntrySummary,
} from "./payment-store.js";
import {
  badRequest,
  ENTRY_OVER_ALLOCATION_MESSAGE,
  INSTALLMENT_NOT_FOUND_MESSAGE,
  INSTALLMENT_OVER_ALLOCATION_MESSAGE,
  INSTALLMENT_PAYER_MISMATCH_MESSAGE,
  notFound,
  PAYMENT_COMMAND_CONFLICT_MESSAGE,
  PAYER_NOT_FOUND_MESSAGE,
  sortStrings,
  WAIVED_INSTALLMENT_ALLOCATION_MESSAGE,
  type FinanceDatabase,
} from "./shared.js";

export type RegisterPaymentInput = z.infer<typeof financeRegisterPaymentInputSchema>;

export type RegisterPaymentResult = {
  paymentEntry: PaymentEntrySummary;
  allocations: PaymentAllocationSummary[];
  unallocatedRemainderCents: number;
};
type PaymentValidation = {
  installments: LoadedInstallment[];
  allocations: PaymentAllocationInput[];
  payerId: string;
  date: Date;
  commandId?: string | undefined;
};
type PunctualityAdjustment = { installmentId: string; amountCents: number };
const DATE_ONLY_LENGTH = 10;

export async function registerPayment(input: {
  database: FinanceDatabase;
  values: RegisterPaymentInput;
  staffUserId: string;
  now?: Date;
}): Promise<RegisterPaymentResult> {
  const existing = await findPaymentCommand(input.database, input.values);
  if (existing) return existing;
  await assertPayerExists(input.database, input.values.payerId);

  const allocationRows = combineAllocationsByInstallment(input.values.allocations);
  const allocationTotalCents = allocationRows.reduce((total, row) => total + row.amountCents, 0);

  if (allocationTotalCents > input.values.amountCents) {
    throw badRequest(ENTRY_OVER_ALLOCATION_MESSAGE);
  }

  const installmentIds = sortStrings(allocationRows.map((row) => row.installmentId));
  await lockInstallments(input.database, installmentIds);

  const installments = await loadInstallments(input.database, installmentIds);
  assertAllInstallmentsFound(installments, installmentIds);
  assertInstallmentsAllocatable({
    installments,
    allocations: allocationRows,
    payerId: input.values.payerId,
    date: input.values.date,
    commandId: input.values.commandId,
  });

  const lines = await prepareContractPayment({ ...input, now: input.now ?? new Date() });
  await persistSettlementAdjustments({
    ...input,
    date: input.values.date.toISOString().slice(0, DATE_ONLY_LENGTH),
    lines,
  });

  const { paymentEntry, allocations } = await persistPayment({
    database: input.database,
    values: {
      ...input.values,
      commandFingerprint: input.values.commandId ? fingerprint(input.values) : undefined,
    },
    allocationRows,
    staffUserId: input.staffUserId,
  });

  return {
    paymentEntry,
    allocations,
    unallocatedRemainderCents: input.values.amountCents - allocationTotalCents,
  };
}

function fingerprint(values: RegisterPaymentInput): string {
  const combined = combineAllocationsByInstallment(values.allocations);
  const amountsById = new Map(combined.map((row) => [row.installmentId, row.amountCents]));
  const canonical = JSON.stringify({
    payerId: values.payerId,
    date: values.date.toISOString().slice(0, DATE_ONLY_LENGTH),
    amountCents: values.amountCents,
    method: values.method,
    note: values.note ?? null,
    externalReference: values.externalReference ?? null,
    allocations: sortStrings(combined.map((row) => row.installmentId)).map((installmentId) => ({
      installmentId,
      amountCents: amountsById.get(installmentId),
    })),
  });
  return createHash("sha256").update(canonical).digest("hex");
}

export async function findPaymentCommand(
  database: FinanceDatabase,
  values: RegisterPaymentInput,
): Promise<RegisterPaymentResult | null> {
  if (!values.commandId) return null;
  const row = await database.paymentEntry.findUnique({
    where: { commandId: values.commandId },
    include: { allocations: true },
  });
  if (!row) return null;
  if (row.commandFingerprint !== fingerprint(values)) {
    throw badRequest(PAYMENT_COMMAND_CONFLICT_MESSAGE);
  }
  const allocated = row.allocations.reduce((sum, allocation) => sum + allocation.amountCents, 0);
  return {
    paymentEntry: {
      id: row.id,
      payerId: row.payerId,
      date: row.date,
      amountCents: row.amountCents,
      method: row.method,
      note: row.note,
      externalReference: row.externalReference,
    },
    allocations: row.allocations.map((allocation) => ({
      id: allocation.id,
      paymentEntryId: allocation.paymentEntryId,
      installmentId: allocation.installmentId,
      amountCents: allocation.amountCents,
    })),
    unallocatedRemainderCents: row.amountCents - allocated,
  };
}

async function assertPayerExists(database: FinanceDatabase, payerId: string): Promise<void> {
  const payer = await database.payer.findUnique({
    where: { id: payerId },
    select: { id: true },
  });

  if (payer === null) {
    throw notFound(PAYER_NOT_FOUND_MESSAGE);
  }
}

function combineAllocationsByInstallment(
  allocations: PaymentAllocationInput[],
): PaymentAllocationInput[] {
  const amountsByInstallment = new Map<string, number>();

  for (const allocation of allocations) {
    amountsByInstallment.set(
      allocation.installmentId,
      (amountsByInstallment.get(allocation.installmentId) ?? 0) + allocation.amountCents,
    );
  }

  return [...amountsByInstallment.entries()].map(([installmentId, amountCents]) => ({
    installmentId,
    amountCents,
  }));
}

function assertAllInstallmentsFound(
  installments: LoadedInstallment[],
  installmentIds: string[],
): void {
  if (installments.length !== installmentIds.length) {
    throw notFound(INSTALLMENT_NOT_FOUND_MESSAGE);
  }
}

function assertInstallmentsAllocatable(input: PaymentValidation): PunctualityAdjustment[] {
  const discounts: PunctualityAdjustment[] = [];
  const installmentsById = new Map(
    input.installments.map((installment) => [installment.id, installment]),
  );

  for (const allocation of input.allocations) {
    const installment = installmentsById.get(allocation.installmentId);

    if (installment === undefined) {
      throw notFound(INSTALLMENT_NOT_FOUND_MESSAGE);
    }

    const amountCents = validateAllocation({ installment, allocation, input });
    if (amountCents > 0) discounts.push({ installmentId: installment.id, amountCents });
  }
  return discounts;
}

function validateAllocation(values: {
  installment: LoadedInstallment;
  allocation: PaymentAllocationInput;
  input: PaymentValidation;
}): number {
  const { installment, allocation, input } = values;
  if ((installment.order.contract?.payerId ?? installment.order.payerId) !== input.payerId) {
    throw badRequest(INSTALLMENT_PAYER_MISMATCH_MESSAGE);
  }
  if (installment.waivedAt !== null) throw badRequest(WAIVED_INSTALLMENT_ALLOCATION_MESSAGE);
  if (installment.order.contract !== null) {
    return 0;
  }
  if (allocation.amountCents > calculateRemainingBalanceCents(installment)) {
    throw badRequest(INSTALLMENT_OVER_ALLOCATION_MESSAGE);
  }
  return 0;
}
