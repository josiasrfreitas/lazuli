import type { PaymentAllocation, PaymentEntry } from "@lazuli/db";

import type { FinanceDatabase } from "./shared.js";

export type PaymentAllocationInput = {
  installmentId: string;
  amountCents: number;
};

export type LoadedInstallment = {
  id: string;
  amountCents: number;
  dueDate: Date;
  waivedAt: Date | null;
  order: { payerId: string; cancelledAt: Date | null };
  adjustments: Array<{ amountCents: number }>;
  allocations: Array<{ amountCents: number }>;
};

export type PaymentEntrySummary = Pick<
  PaymentEntry,
  "id" | "payerId" | "date" | "amountCents" | "method" | "note" | "externalReference"
>;

export type PaymentAllocationSummary = Pick<
  PaymentAllocation,
  "id" | "paymentEntryId" | "installmentId" | "amountCents"
>;

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

export async function persistPayment(input: {
  database: FinanceDatabase;
  values: {
    payerId: string;
    date: Date;
    amountCents: number;
    method: PaymentEntry["method"];
    note?: string | null | undefined;
    externalReference?: string | null | undefined;
  };
  allocationRows: PaymentAllocationInput[];
  staffUserId: string;
}): Promise<{ paymentEntry: PaymentEntrySummary; allocations: PaymentAllocationSummary[] }> {
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

  const allocations: PaymentAllocationSummary[] = [];
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

export async function lockInstallments(
  database: FinanceDatabase,
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

export async function loadInstallments(
  database: FinanceDatabase,
  installmentIds: string[],
): Promise<LoadedInstallment[]> {
  const installments = await database.installment.findMany({
    where: { id: { in: installmentIds } },
    select: {
      id: true,
      amountCents: true,
      dueDate: true,
      waivedAt: true,
      order: { select: { payerId: true, cancelledAt: true } },
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

export function calculateRemainingBalanceCents(installment: LoadedInstallment): number {
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
