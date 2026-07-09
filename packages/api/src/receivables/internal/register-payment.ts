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
  PAYER_NOT_FOUND_MESSAGE,
  sortStrings,
  WAIVED_INSTALLMENT_ALLOCATION_MESSAGE,
  type ReceivablesDatabase,
} from "./shared.js";

export type RegisterPaymentInput = z.infer<typeof financeRegisterPaymentInputSchema>;

export type RegisterPaymentResult = {
  paymentEntry: PaymentEntrySummary;
  allocations: PaymentAllocationSummary[];
  unallocatedRemainderCents: number;
};

export async function registerPayment(input: {
  database: ReceivablesDatabase;
  values: RegisterPaymentInput;
  staffUserId: string;
}): Promise<RegisterPaymentResult> {
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
  });

  const { paymentEntry, allocations } = await persistPayment({
    database: input.database,
    values: input.values,
    allocationRows,
    staffUserId: input.staffUserId,
  });

  return {
    paymentEntry,
    allocations,
    unallocatedRemainderCents: input.values.amountCents - allocationTotalCents,
  };
}

async function assertPayerExists(database: ReceivablesDatabase, payerId: string): Promise<void> {
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

function assertInstallmentsAllocatable(input: {
  installments: LoadedInstallment[];
  allocations: PaymentAllocationInput[];
  payerId: string;
}): void {
  const installmentsById = new Map(
    input.installments.map((installment) => [installment.id, installment]),
  );

  for (const allocation of input.allocations) {
    const installment = installmentsById.get(allocation.installmentId);

    if (installment === undefined) {
      throw notFound(INSTALLMENT_NOT_FOUND_MESSAGE);
    }

    if (installment.order.payerId !== input.payerId) {
      throw badRequest(INSTALLMENT_PAYER_MISMATCH_MESSAGE);
    }

    if (installment.waivedAt !== null) {
      throw badRequest(WAIVED_INSTALLMENT_ALLOCATION_MESSAGE);
    }

    if (allocation.amountCents > calculateRemainingBalanceCents(installment)) {
      throw badRequest(INSTALLMENT_OVER_ALLOCATION_MESSAGE);
    }
  }
}
