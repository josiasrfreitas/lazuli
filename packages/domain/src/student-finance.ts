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
const SEVERE_OVERDUE_DAYS = 30;
export type StudentFinanceDebtState = "NO_OVERDUE" | "OVERDUE" | "SEVERE_OVERDUE";
export type StudentFinancePaymentState =
  | "INSUFFICIENT_HISTORY"
  | "ON_TIME"
  | "OCCASIONAL_DELAY"
  | "RECURRING_DELAY";

export type StudentFinanceSummary = {
  debtState: StudentFinanceDebtState;
  installmentCount: number;
  receivedCents: number;
  outstandingCents: number;
  totalCents: number;
  overdueCents: number;
  overdueCount: number;
  oldestOverdueDays: number;
  nextDueDate: string | null;
  nextDueCents: number;
  history: {
    paymentState: StudentFinancePaymentState;
    settledLateMonths: number;
    settledCount: number;
    onTimeCount: number;
    lateCount: number;
    lateMonths: number;
    averageLateDays: number | null;
  };
};

/** Uses the same adjusted balances as the ledger, including partial receipts and waivers. */
export function studentFinanceSummary(
  installments: readonly FinanceInstallment[],
  allocations: readonly DatedAllocation[],
): StudentFinanceSummary {
  const settlements = settledPayments(installments, allocations);
  const overdue = installments.filter(
    (row) => row.status === "OVERDUE" && row.collectibleBalanceCents > 0,
  );
  const upcoming = installments
    .filter((row) => row.collectibleBalanceCents > 0 && row.status !== "OVERDUE")
    .toSorted((left, right) => left.dueDate.localeCompare(right.dueDate));
  const receivedCents = installments.reduce((sum, row) => sum + row.paidAmountCents, 0);
  const outstandingCents = installments.reduce((sum, row) => sum + row.collectibleBalanceCents, 0);
  const oldestOverdueDays = oldestOverdue(overdue);
  return {
    debtState: debtState(oldestOverdueDays, overdue.length),
    installmentCount: installments.length,
    receivedCents,
    outstandingCents,
    totalCents: receivedCents + outstandingCents,
    overdueCents: overdue.reduce((sum, row) => sum + row.collectibleBalanceCents, 0),
    overdueCount: overdue.length,
    oldestOverdueDays,
    nextDueDate: upcoming[0]?.dueDate ?? null,
    nextDueCents: upcoming
      .filter((row) => row.dueDate === upcoming[0]?.dueDate)
      .reduce((sum, row) => sum + row.collectibleBalanceCents, 0),
    history: paymentHistory(settlements, overdue),
  };
}

function oldestOverdue(installments: readonly FinanceInstallment[]): number {
  let days = 0;
  for (const installment of installments) days = Math.max(days, installment.overdueDays);
  return days;
}

function debtState(days: number, count: number): StudentFinanceDebtState {
  if (days > SEVERE_OVERDUE_DAYS) return "SEVERE_OVERDUE";
  return count > 0 ? "OVERDUE" : "NO_OVERDUE";
}

function paymentHistory(
  settlements: StudentSettlement[],
  overdue: FinanceInstallment[],
): StudentFinanceSummary["history"] {
  const late = settlements.filter((row) => row.lateDays > 0);
  const settledLateMonths = new Set(late.map((row) => row.dueDate.slice(0, MONTH_KEY_LENGTH))).size;
  return {
    paymentState: paymentState(settledLateMonths, settlements.length),
    settledLateMonths,
    settledCount: settlements.length,
    onTimeCount: settlements.length - late.length,
    lateCount: late.length,
    lateMonths: new Set([...late, ...overdue].map((row) => row.dueDate.slice(0, MONTH_KEY_LENGTH)))
      .size,
    averageLateDays:
      late.length > 0
        ? Math.round(late.reduce((sum, row) => sum + row.lateDays, 0) / late.length)
        : null,
  };
}

function paymentState(lateMonths: number, settledCount: number): StudentFinancePaymentState {
  if (lateMonths > 1) return "RECURRING_DELAY";
  if (lateMonths === 1) return "OCCASIONAL_DELAY";
  return settledCount > 0 ? "ON_TIME" : "INSUFFICIENT_HISTORY";
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
    const entries = (byInstallment.get(installment.installmentId) ?? []).toSorted((left, right) =>
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
