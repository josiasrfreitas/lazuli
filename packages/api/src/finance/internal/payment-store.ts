import type { PaymentAllocation, PaymentEntry } from "@lazuli/db";

import { badRequest } from "../../trpc/errors.js";
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
  order: {
    payerId: string | null;
    contract: { payerId: string; punctualityDiscountPct: { toNumber(): number } | null } | null;
    cancelledAt: Date | null;
  };
  adjustments: Array<{ amountCents: number }>;
  allocations: Array<{ amountCents: number }>;
};

export type PaymentEntrySummary = Pick<
  PaymentEntry,
  | "id"
  | "payerId"
  | "date"
  | "amountCents"
  | "method"
  | "externalInstallments"
  | "note"
  | "externalReference"
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
  externalInstallments: true,
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
    commandId?: string | undefined;
    commandFingerprint?: string | undefined;
    payerId: string;
    date: Date;
    amountCents: number;
    method: PaymentEntry["method"];
    externalInstallments?: number | undefined;
    note?: string | null | undefined;
    externalReference?: string | null | undefined;
    thirdPartyName?: string | null | undefined;
  };
  allocationRows: PaymentAllocationInput[];
  staffUserId: string;
}): Promise<{ paymentEntry: PaymentEntrySummary; allocations: PaymentAllocationSummary[] }> {
  const method = await input.database.paymentMethod.findFirst({
    where: { code: input.values.method, active: true, deletedAt: null },
    select: { id: true, allowsExternalInstallments: true },
  });
  if (!method) throw badRequest("Selecione uma forma de pagamento disponível.");
  const externalInstallments = validatedExternalInstallments(
    input.values.externalInstallments,
    method.allowsExternalInstallments,
  );
  const paymentEntry = await input.database.paymentEntry.create({
    data: {
      payerId: input.values.payerId,
      commandId: input.values.commandId ?? null,
      commandFingerprint: input.values.commandFingerprint ?? null,
      date: input.values.date,
      amountCents: input.values.amountCents,
      method: input.values.method,
      externalInstallments,
      note: input.values.note ?? null,
      externalReference: input.values.externalReference ?? null,
      thirdPartyName: input.values.thirdPartyName?.trim() || null,
      createdById: input.staffUserId,
      updatedById: input.staffUserId,
    },
    select: paymentEntrySelect,
  });

  const allocations = await persistAllocations(input, paymentEntry.id);
  return { paymentEntry, allocations };
}

function validatedExternalInstallments(requested: number | undefined, allowed: boolean): number {
  const count = requested ?? 1;
  if (!Number.isInteger(count) || count < 1)
    throw badRequest("Informe uma quantidade válida de parcelas no banco.");
  if (count > 1 && !allowed)
    throw badRequest("Esta forma de pagamento não permite parcelamento por terceiros.");
  return count;
}

async function persistAllocations(
  input: Pick<Parameters<typeof persistPayment>[0], "database" | "allocationRows" | "staffUserId">,
  paymentEntryId: string,
): Promise<PaymentAllocationSummary[]> {
  const allocations: PaymentAllocationSummary[] = [];
  for (const allocation of input.allocationRows) {
    allocations.push(
      await input.database.paymentAllocation.create({
        data: {
          paymentEntryId,
          installmentId: allocation.installmentId,
          amountCents: allocation.amountCents,
          createdById: input.staffUserId,
          updatedById: input.staffUserId,
        },
        select: paymentAllocationSelect,
      }),
    );
  }
  return allocations;
}

export async function lockInstallments(
  database: Pick<FinanceDatabase, "$queryRaw">,
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
      order: {
        select: {
          payerId: true,
          contract: { select: { payerId: true, punctualityDiscountPct: true } },
          cancelledAt: true,
        },
      },
    },
  });
  const adjustments = await database.installmentAdjustment.findMany({
    where: { installmentId: { in: installmentIds }, deletedAt: null },
    select: { installmentId: true, amountCents: true },
  });
  const allocations = await database.paymentAllocation.findMany({
    where: {
      installmentId: { in: installmentIds },
      deletedAt: null,
      paymentEntry: { deletedAt: null },
    },
    select: {
      installmentId: true,
      amountCents: true,
      reversals: {
        where: { deletedAt: null, reversal: { deletedAt: null } },
        select: { amountCents: true },
      },
    },
  });

  return installments.map((installment) => ({
    ...installment,
    adjustments: adjustments.filter((adjustment) => adjustment.installmentId === installment.id),
    allocations: allocations
      .filter((allocation) => allocation.installmentId === installment.id)
      .map((allocation) => ({
        amountCents:
          allocation.amountCents -
          allocation.reversals.reduce((total, reversal) => total + reversal.amountCents, 0),
      })),
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
