import { saoPauloDateOnly } from "@lazuli/domain";
import type { FinanceDatabase } from "./shared.js";
import { ledgerQuery, type InstallmentQueryRow } from "./installments-query.js";

const MONTHS_IN_YEAR = 12;
const MONTH_KEY_LENGTH = 7;
const FIRST_AGING_LIMIT = 30;
const SECOND_AGING_LIMIT = 60;
const THIRD_AGING_LIMIT = 90;
type MonthlyAmounts = {
  month: string;
  expectedCents: number;
  receivedCents: number;
  balanceCents: number;
};
type AgingAmounts = { label: string; balanceCents: number; count: number };
export type FinanceAnalytics = {
  year: number;
  asOf: string;
  months: MonthlyAmounts[];
  methods: { method: string; receivedCents: number; count: number }[];
  aging: AgingAmounts[];
  receivedCents: number;
  expectedCents: number;
  overdueCents: number;
  overduePayers: number;
  maturedCents: number;
  settledMaturedCents: number;
};
type AnalyticsInput = { year: number; now: Date };

export async function readAnalytics(
  database: FinanceDatabase,
  input: AnalyticsInput,
): Promise<FinanceAnalytics> {
  const asOf = saoPauloDateOnly(input.now);
  const ledger = ledgerQuery({ kysely: database.$kysely, businessDate: asOf, search: undefined });
  const installments = await ledger.selectFrom("ledger").selectAll().execute();
  const payments = await database.paymentEntry.findMany({
    where: {
      deletedAt: null,
      date: {
        gte: new Date(`${input.year}-01-01`),
        lt: new Date(`${input.year + 1}-01-01`),
        lte: new Date(asOf),
      },
    },
    select: { date: true, amountCents: true, method: true },
  });
  return aggregateAnalytics({ ...input, asOf, installments, payments });
}

type LedgerRow = InstallmentQueryRow;
type AggregateInput = AnalyticsInput & {
  asOf: string;
  installments: LedgerRow[];
  payments: { date: Date; amountCents: number; method: string }[];
};
function aggregateAnalytics(input: AggregateInput): FinanceAnalytics {
  const months = Array.from({ length: MONTHS_IN_YEAR }, (_, index) => ({
    month: `${input.year}-${String(index + 1).padStart(2, "0")}`,
    expectedCents: 0,
    receivedCents: 0,
    balanceCents: 0,
  }));
  const methods = paymentMethods(input.payments);
  for (const payment of input.payments) {
    const month = months.find(
      (item) => item.month === payment.date.toISOString().slice(0, MONTH_KEY_LENGTH),
    );
    if (month) month.receivedCents += payment.amountCents;
  }
  for (const installment of input.installments) addInstallment(months, installment);
  const matured = input.installments.filter(
    (row) =>
      row.dueDate.startsWith(`${input.year}-`) &&
      row.dueDate <= input.asOf &&
      row.status !== "WAIVED",
  );
  const overdue = input.installments.filter((row) => row.status === "OVERDUE");
  return {
    year: input.year,
    asOf: input.asOf,
    months,
    methods,
    aging: agingBuckets(overdue),
    receivedCents: months.reduce((sum, month) => sum + month.receivedCents, 0),
    expectedCents: months.reduce((sum, month) => sum + month.expectedCents, 0),
    overdueCents: overdue.reduce((sum, row) => sum + row.collectibleBalanceCents, 0),
    overduePayers: new Set(overdue.map((row) => row.payerId)).size,
    maturedCents: matured.reduce((sum, row) => sum + row.expectedAmountCents, 0),
    settledMaturedCents: matured.reduce(
      (sum, row) => sum + row.expectedAmountCents - row.collectibleBalanceCents,
      0,
    ),
  };
}
function addInstallment(months: MonthlyAmounts[], row: LedgerRow): void {
  if (row.status === "WAIVED") return;
  const month = months.find((item) => item.month === row.dueDate.slice(0, MONTH_KEY_LENGTH));
  if (!month) return;
  month.expectedCents += row.expectedAmountCents;
  month.balanceCents += row.collectibleBalanceCents;
}
function paymentMethods(payments: AggregateInput["payments"]): FinanceAnalytics["methods"] {
  const amounts = new Map<string, { method: string; receivedCents: number; count: number }>();
  for (const payment of payments) {
    const entry = amounts.get(payment.method) ?? {
      method: payment.method,
      receivedCents: 0,
      count: 0,
    };
    entry.receivedCents += payment.amountCents;
    entry.count += 1;
    amounts.set(payment.method, entry);
  }
  return [...amounts.values()].sort((left, right) => right.receivedCents - left.receivedCents);
}
function agingBuckets(rows: LedgerRow[]): AgingAmounts[] {
  const buckets = [
    { label: "1–30 dias", limit: FIRST_AGING_LIMIT, balanceCents: 0, count: 0 },
    { label: "31–60 dias", limit: SECOND_AGING_LIMIT, balanceCents: 0, count: 0 },
    { label: "61–90 dias", limit: THIRD_AGING_LIMIT, balanceCents: 0, count: 0 },
    { label: "Mais de 90 dias", limit: Infinity, balanceCents: 0, count: 0 },
  ];
  for (const row of rows) {
    const bucket = buckets.find((item) => row.overdueDays <= item.limit)!;
    bucket.balanceCents += row.collectibleBalanceCents;
    bucket.count += 1;
  }
  return buckets.map(({ label, balanceCents, count }) => ({ label, balanceCents, count }));
}
