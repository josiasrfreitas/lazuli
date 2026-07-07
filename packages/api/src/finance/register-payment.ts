import type { PaymentAllocation, PaymentEntry, Prisma } from "@lazuli/db";
import type { financeRegisterPaymentInputSchema, z } from "@lazuli/validators";

import {
  badRequest,
  ENTRY_OVER_ALLOCATION_MESSAGE,
  INSTALLMENT_NOT_FOUND_MESSAGE,
  INSTALLMENT_OVER_ALLOCATION_MESSAGE,
  INSTALLMENT_PAYER_MISMATCH_MESSAGE,
  notFound,
  PAYER_NOT_FOUND_MESSAGE,
  WAIVED_INSTALLMENT_ALLOCATION_MESSAGE,
} from "./errors.js";

type RegisterPaymentInput = z.infer<typeof financeRegisterPaymentInputSchema>;
type PaymentAllocationInput = {
  installmentId: string;
  amountCents: number;
};

type PaymentDatabase = Pick<
  Prisma.TransactionClient,
  | "$queryRaw"
  | "payer"
  | "installment"
  | "installmentAdjustment"
  | "paymentEntry"
  | "paymentAllocation"
>;

type LoadedInstallment = {
  id: string;
  amountCents: number;
  waivedAt: Date | null;
  order: { payerId: string };
  adjustments: Array<{ amountCents: number }>;
  allocations: Array<{ amountCents: number }>;
};

export type RegisterPaymentResult = {
  paymentEntry: Pick<
    PaymentEntry,
    "id" | "payerId" | "date" | "amountCents" | "method" | "note" | "externalReference"
  >;
  allocations: Array<
    Pick<PaymentAllocation, "id" | "paymentEntryId" | "installmentId" | "amountCents">
  >;
  unallocatedRemainderCents: number;
};

const paymentEntrySelect = {
  id: true,
  payerId: true,
  date: true,
  amountCents: true,
  method: true,
  note: true,
  externalReference: true,
} as const;

const paymentAllocationSelect = {
  id: true,
  paymentEntryId: true,
  installmentId: true,
  amountCents: true,
} as const;

export async function registerPayment(input: {
  database: PaymentDatabase;
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

async function persistPayment(input: {
  database: PaymentDatabase;
  values: RegisterPaymentInput;
  allocationRows: PaymentAllocationInput[];
  staffUserId: string;
}): Promise<Pick<RegisterPaymentResult, "paymentEntry" | "allocations">> {
  const paymentEntry = await input.database.paymentEntry.create({
    data: {
      payerId: input.values.payerId,
      date: input.values.date,
      amountCents: input.values.amountCents,
      method: input.values.method,
      note: input.values.note ?? null,
      externalReference: input.values.externalReference ?? null,
      createdById: input.staffUserId,
      updatedById: input.staffUserId,
    },
    select: paymentEntrySelect,
  });

  const allocations: RegisterPaymentResult["allocations"] = [];
  for (const allocation of input.allocationRows) {
    allocations.push(
      await input.database.paymentAllocation.create({
        data: {
          paymentEntryId: paymentEntry.id,
          installmentId: allocation.installmentId,
          amountCents: allocation.amountCents,
          createdById: input.staffUserId,
          updatedById: input.staffUserId,
        },
        select: paymentAllocationSelect,
      }),
    );
  }

  return { paymentEntry, allocations };
}

async function assertPayerExists(database: PaymentDatabase, payerId: string): Promise<void> {
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

async function lockInstallments(
  database: PaymentDatabase,
  installmentIds: string[],
): Promise<void> {
  await database.$queryRaw`
    SELECT id
    FROM "Installment"
    WHERE id = ANY(${installmentIds}::uuid[])
    ORDER BY id
    FOR UPDATE
  `;
}

async function loadInstallments(
  database: PaymentDatabase,
  installmentIds: string[],
): Promise<LoadedInstallment[]> {
  const installments = await database.installment.findMany({
    where: { id: { in: installmentIds } },
    select: {
      id: true,
      amountCents: true,
      waivedAt: true,
      order: { select: { payerId: true } },
    },
  });
  const adjustments = await database.installmentAdjustment.findMany({
    where: { installmentId: { in: installmentIds } },
    select: { installmentId: true, amountCents: true },
  });
  const allocations = await database.paymentAllocation.findMany({
    where: { installmentId: { in: installmentIds } },
    select: { installmentId: true, amountCents: true },
  });

  return installments.map((installment) => ({
    ...installment,
    adjustments: adjustments.filter((adjustment) => adjustment.installmentId === installment.id),
    allocations: allocations.filter((allocation) => allocation.installmentId === installment.id),
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

function sortStrings(values: string[]): string[] {
  let sortedValues: string[] = [];

  for (const value of values) {
    const insertionIndex = sortedValues.findIndex((sortedValue) => sortedValue > value);

    if (insertionIndex === -1) {
      sortedValues = [...sortedValues, value];
      continue;
    }

    sortedValues = [
      ...sortedValues.slice(0, insertionIndex),
      value,
      ...sortedValues.slice(insertionIndex),
    ];
  }

  return sortedValues;
}

function calculateRemainingBalanceCents(installment: LoadedInstallment): number {
  const adjustmentTotal = installment.adjustments.reduce(
    (total, adjustment) => total + adjustment.amountCents,
    0,
  );
  const allocatedTotal = installment.allocations.reduce(
    (total, allocation) => total + allocation.amountCents,
    0,
  );

  return installment.amountCents + adjustmentTotal - allocatedTotal;
}
