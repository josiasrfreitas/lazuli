type FinanceInstallment = {
  installmentId: string;
  dueDate: string;
  status: string;
  expectedAmountCents: number;
  paidAmountCents: number;
  collectibleBalanceCents: number;
  overdueDays: number;
};
type DatedAllocation = { installmentId: string; date: string; amountCents: number };
export type StudentSettlement = {
  installmentId: string;
  dueDate: string;
  paidDate: string;
  lateDays: number;
};
const DAY_MILLISECONDS = 86_400_000;
const MONTH_KEY_LENGTH = 7;

/** Uses the same adjusted balances as the ledger, including partial receipts and waivers. */
export function studentFinanceSummary(
  installments: readonly FinanceInstallment[],
  allocations: readonly DatedAllocation[],
) {
  const settlements = settledPayments(installments, allocations);
  const late = settlements.filter((row) => row.lateDays > 0);
  const overdue = installments.filter((row) => row.status === "OVERDUE");
  const upcoming = installments
    .filter((row) => row.collectibleBalanceCents > 0 && row.status !== "OVERDUE")
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate));
  const receivedCents = installments.reduce((sum, row) => sum + row.paidAmountCents, 0);
  const outstandingCents = installments.reduce((sum, row) => sum + row.collectibleBalanceCents, 0);
  return {
    installmentCount: installments.length,
    receivedCents,
    outstandingCents,
    totalCents: receivedCents + outstandingCents,
    overdueCents: overdue.reduce((sum, row) => sum + row.collectibleBalanceCents, 0),
    overdueCount: overdue.length,
    oldestOverdueDays: overdue.reduce((maximum, row) => Math.max(maximum, row.overdueDays), 0),
    nextDueDate: upcoming[0]?.dueDate ?? null,
    nextDueCents: upcoming
      .filter((row) => row.dueDate === upcoming[0]?.dueDate)
      .reduce((sum, row) => sum + row.collectibleBalanceCents, 0),
    history: {
      settledCount: settlements.length,
      onTimeCount: settlements.length - late.length,
      lateCount: late.length,
      lateMonths: new Set(
        [...late, ...overdue].map((row) => row.dueDate.slice(0, MONTH_KEY_LENGTH)),
      ).size,
      averageLateDays: late.length
        ? Math.round(late.reduce((sum, row) => sum + row.lateDays, 0) / late.length)
        : null,
    },
  };
}

/** The payment completing the adjusted amount determines punctuality, not today's overdue age. */
function settledPayments(
  installments: readonly FinanceInstallment[],
  allocations: readonly DatedAllocation[],
): StudentSettlement[] {
  const byInstallment = new Map<string, DatedAllocation[]>();
  for (const allocation of allocations) {
    const entries = byInstallment.get(allocation.installmentId) ?? [];
    entries.push(allocation);
    byInstallment.set(allocation.installmentId, entries);
  }
  return installments.flatMap((installment) => {
    if (installment.status !== "PAID" || installment.expectedAmountCents <= 0) return [];
    const entries = (byInstallment.get(installment.installmentId) ?? []).sort((left, right) =>
      left.date.localeCompare(right.date),
    );
    let received = 0;
    const finalPayment = entries.find((entry) => {
      received += entry.amountCents;
      return received >= installment.expectedAmountCents;
    });
    if (!finalPayment) return [];
    return [
      {
        installmentId: installment.installmentId,
        dueDate: installment.dueDate,
        paidDate: finalPayment.date,
        lateDays: Math.max(
          0,
          Math.round(
            (Date.parse(finalPayment.date) - Date.parse(installment.dueDate)) / DAY_MILLISECONDS,
          ),
        ),
      },
    ];
  });
}

export type StudentFinanceSummary = ReturnType<typeof studentFinanceSummary>;
