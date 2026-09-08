import { deriveInstallmentLedger } from "@lazuli/domain";

import { loadInterestRatePctMonthly, type ReceivablesDatabase } from "./shared.js";

/**
 * Per-student roll-up of the derived ledger, for listings that show one finance
 * fact per student (§4.7). `hasActiveOrder` separates "no order at all" ("—")
 * from "order settled" ("Em dia"); `overdueCents` sums the collectible remainder
 * of every installment the ledger reports as OVERDUE.
 */

export type StudentOverdueTotal = {
  studentId: string;
  hasActiveOrder: boolean;
  overdueCents: number;
};

type LoadedBeneficiary = {
  studentId: string;
  order: {
    cancelledAt: Date | null;
    installments: Array<{
      amountCents: number;
      dueDate: Date;
      waivedAt: Date | null;
      adjustments: Array<{ amountCents: number }>;
      allocations: Array<{ amountCents: number }>;
    }>;
  };
};

export async function studentOverdueTotals(input: {
  database: ReceivablesDatabase;
  values: { studentIds: readonly string[]; now: Date };
}): Promise<StudentOverdueTotal[]> {
  if (input.values.studentIds.length === 0) {
    return [];
  }

  const interestRatePctMonthly = await loadInterestRatePctMonthly(input.database);
  const beneficiaries = await loadBeneficiaries(input.database, input.values.studentIds);

  return input.values.studentIds.map((studentId) => {
    const links = beneficiaries.filter((beneficiary) => beneficiary.studentId === studentId);
    let overdueCents = 0;

    for (const link of links) {
      overdueCents += sumOverdueCents({ link, now: input.values.now, interestRatePctMonthly });
    }

    return { studentId, hasActiveOrder: links.length > 0, overdueCents };
  });
}

function sumOverdueCents(input: {
  link: LoadedBeneficiary;
  now: Date;
  interestRatePctMonthly: number;
}): number {
  let overdueCents = 0;

  for (const installment of input.link.order.installments) {
    const ledger = deriveInstallmentLedger({
      ...installment,
      orderCancelledAt: input.link.order.cancelledAt,
      now: input.now,
      interestRatePctMonthly: input.interestRatePctMonthly,
    });

    if (ledger.status === "OVERDUE") {
      overdueCents += ledger.collectibleRemainingCents;
    }
  }

  return overdueCents;
}

function loadBeneficiaries(
  database: ReceivablesDatabase,
  studentIds: readonly string[],
): Promise<LoadedBeneficiary[]> {
  return database.orderBeneficiary.findMany({
    where: {
      studentId: { in: [...studentIds] },
      deletedAt: null,
      order: { cancelledAt: null, deletedAt: null },
    },
    select: {
      studentId: true,
      order: {
        select: {
          cancelledAt: true,
          installments: {
            where: { deletedAt: null },
            select: {
              amountCents: true,
              dueDate: true,
              waivedAt: true,
              adjustments: { where: { deletedAt: null }, select: { amountCents: true } },
              allocations: { where: { deletedAt: null }, select: { amountCents: true } },
            },
          },
        },
      },
    },
  });
}
