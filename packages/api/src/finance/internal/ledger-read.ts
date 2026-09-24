import {
  buildReceivablesSnapshot,
  deriveInstallmentLedger,
  saoPauloMonthDateOnlyUtcBounds,
  toWhatsAppUrl,
  type InstallmentLedger,
  type ReceivablesSnapshot,
} from "@lazuli/domain";

import { loadInterestRatePctMonthly, toDateOnlyString, type FinanceDatabase } from "./shared.js";

type LoadedReceivablesInstallment = {
  id: string;
  orderId: string;
  amountCents: number;
  dueDate: Date;
  waivedAt: Date | null;
  order: {
    cancelledAt: Date | null;
    payer: { id: string; name: string } | null;
    contract: {
      payer: { id: string; name: string };
      student: { id: string; fullName: string; phone: string | null };
    } | null;
    beneficiaries: Array<{
      student: { id: string; fullName: string; phone: string | null };
    }>;
  };
  adjustments: Array<{ amountCents: number }>;
  allocations: Array<{ amountCents: number }>;
};

export type DerivedReceivablesInstallment = {
  id: string;
  orderId: string;
  dueDate: string;
  isCollectible: boolean;
  ledger: InstallmentLedger;
  payer: { id: string; name: string };
  beneficiaries: Array<{ studentId: string; fullName: string; whatsAppUrl: string | null }>;
};

export type OverdueListRow = {
  installmentId: string;
  orderId: string;
  payer: { id: string; name: string };
  beneficiaries: Array<{ studentId: string; fullName: string; whatsAppUrl: string | null }>;
  dueDate: string;
  ledger: InstallmentLedger;
};

export type OverdueListResult = {
  rows: OverdueListRow[];
};

export async function receivablesSnapshot(database: FinanceDatabase): Promise<ReceivablesSnapshot> {
  const now = new Date();
  const derivedInstallments = await loadDerivedReceivablesInstallments(database, now);
  const receivedThisMonthCents = await loadReceivedThisMonthCents(database, now);

  return buildReceivablesSnapshot({
    now,
    receivedThisMonthCents,
    installments: derivedInstallments.map((installment) => ({
      dueDate: installment.dueDate,
      isCollectible: installment.isCollectible,
      ledger: installment.ledger,
    })),
  });
}

export async function overdueList(database: FinanceDatabase): Promise<OverdueListResult> {
  const derivedInstallments = await loadDerivedReceivablesInstallments(database);

  const overdueInstallments = derivedInstallments.filter(
    (installment) =>
      installment.isCollectible &&
      installment.ledger.status === "OVERDUE" &&
      installment.ledger.collectibleRemainingCents > 0,
  );

  const rows = sortInstallmentsByDueDate(overdueInstallments).map((installment) => ({
    installmentId: installment.id,
    orderId: installment.orderId,
    payer: installment.payer,
    beneficiaries: installment.beneficiaries,
    dueDate: installment.dueDate,
    ledger: installment.ledger,
  }));

  return { rows };
}

async function loadDerivedReceivablesInstallments(
  database: FinanceDatabase,
  now: Date = new Date(),
): Promise<DerivedReceivablesInstallment[]> {
  const interestRatePctMonthly = await loadInterestRatePctMonthly(database);
  const installments = await loadActiveOrderInstallments(database);

  return installments.map((installment) => {
    const isCollectible = installment.order.cancelledAt === null && installment.waivedAt === null;
    const ledger = deriveInstallmentLedger({
      amountCents: installment.amountCents,
      dueDate: installment.dueDate,
      waivedAt: installment.waivedAt,
      orderCancelledAt: installment.order.cancelledAt,
      adjustments: installment.adjustments,
      allocations: installment.allocations,
      now,
      interestRatePctMonthly: installment.order.contract === null ? interestRatePctMonthly : 0,
    });

    return {
      id: installment.id,
      orderId: installment.orderId,
      dueDate: toDateOnlyString(installment.dueDate),
      isCollectible,
      ledger,
      payer: installment.order.contract?.payer ?? installment.order.payer!,
      beneficiaries:
        installment.order.contract === null
          ? installment.order.beneficiaries.map((beneficiary) => ({
              studentId: beneficiary.student.id,
              fullName: beneficiary.student.fullName,
              whatsAppUrl: toWhatsAppUrl(beneficiary.student.phone),
            }))
          : [
              {
                studentId: installment.order.contract.student.id,
                fullName: installment.order.contract.student.fullName,
                whatsAppUrl: toWhatsAppUrl(installment.order.contract.student.phone),
              },
            ],
    };
  });
}

async function loadReceivedThisMonthCents(database: FinanceDatabase, now: Date): Promise<number> {
  const { startDateOnlyUtc, endExclusiveDateOnlyUtc } = saoPauloMonthDateOnlyUtcBounds(now);
  const allocations = await database.paymentAllocation.findMany({
    where: {
      paymentEntry: {
        date: {
          gte: startDateOnlyUtc,
          lt: endExclusiveDateOnlyUtc,
        },
      },
    },
    select: { amountCents: true },
  });

  return allocations.reduce((total, allocation) => total + allocation.amountCents, 0);
}

async function loadActiveOrderInstallments(
  database: FinanceDatabase,
): Promise<LoadedReceivablesInstallment[]> {
  const installments = await database.installment.findMany({
    where: { order: { cancelledAt: null } },
    select: {
      id: true,
      orderId: true,
      amountCents: true,
      dueDate: true,
      waivedAt: true,
      order: {
        select: {
          cancelledAt: true,
          payer: { select: { id: true, name: true } },
          contract: {
            select: {
              payer: { select: { id: true, name: true } },
              student: { select: { id: true, fullName: true, phone: true } },
            },
          },
          beneficiaries: {
            select: {
              student: { select: { id: true, fullName: true, phone: true } },
            },
          },
        },
      },
    },
  });
  const installmentIds = installments.map((installment) => installment.id);
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

function sortInstallmentsByDueDate(
  installments: DerivedReceivablesInstallment[],
): DerivedReceivablesInstallment[] {
  let sortedInstallments: DerivedReceivablesInstallment[] = [];

  for (const installment of installments) {
    const insertionIndex = sortedInstallments.findIndex(
      (sortedInstallment) => sortedInstallment.dueDate > installment.dueDate,
    );

    if (insertionIndex === -1) {
      sortedInstallments = [...sortedInstallments, installment];
      continue;
    }

    sortedInstallments = [
      ...sortedInstallments.slice(0, insertionIndex),
      installment,
      ...sortedInstallments.slice(insertionIndex),
    ];
  }

  return sortedInstallments;
}
