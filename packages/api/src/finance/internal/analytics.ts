import { sql } from "kysely";
import { saoPauloDateOnly } from "@lazuli/domain";
import { ledgerQuery } from "./installments-query.js";
import type { FinanceDatabase } from "./shared.js";

const MONTHS_IN_YEAR = 12;
type MonthlyAmounts = {
  month: string;
  expectedCents: number;
  receivedCents: number;
  balanceCents: number;
};
export type FinanceAnalytics = {
  year: number;
  asOf: string;
  months: MonthlyAmounts[];
  receivedCents: number;
  expectedCents: number;
  overdueCents: number;
  overduePayers: number;
  maturedCents: number;
  settledMaturedCents: number;
};

type ChargeMonth = Omit<MonthlyAmounts, "receivedCents"> &
  Pick<FinanceAnalytics, "maturedCents" | "settledMaturedCents">;
type PaymentMonth = Pick<MonthlyAmounts, "month" | "receivedCents">;
type Overdue = Pick<FinanceAnalytics, "overdueCents" | "overduePayers">;
type Ledger = ReturnType<typeof ledgerQuery>;
type Period = { year: number; asOf: string };

export async function readAnalytics(
  database: FinanceDatabase,
  input: { year: number; now: Date },
): Promise<FinanceAnalytics> {
  const asOf = saoPauloDateOnly(input.now);
  const ledger = ledgerQuery({ kysely: database.$kysely, businessDate: asOf, search: undefined });
  const charges = await readChargeMonths(ledger, { year: input.year, asOf });
  const overdue = await readCurrentOverdue(ledger);
  const payments = await readPaymentMonths(database, { year: input.year, asOf });
  return aggregateAnalytics({ year: input.year, asOf, charges, payments, overdue });
}
function readChargeMonths(ledger: Ledger, { year, asOf }: Period): Promise<ChargeMonth[]> {
  const monthKey = sql<string>`left("dueDate", 7)`;
  return ledger
    .selectFrom("ledger")
    .select([
      monthKey.as("month"),
      sql<number>`sum("expectedAmountCents")::double precision`.as("expectedCents"),
      sql<number>`sum("collectibleBalanceCents")::double precision`.as("balanceCents"),
      sql<number>`coalesce(sum("expectedAmountCents") filter (where "dueDate" <= ${asOf}), 0)::double precision`.as(
        "maturedCents",
      ),
      sql<number>`coalesce(sum("expectedAmountCents" - "collectibleBalanceCents") filter (where "dueDate" <= ${asOf}), 0)::double precision`.as(
        "settledMaturedCents",
      ),
    ])
    .where("status", "!=", "WAIVED")
    .where("dueDate", ">=", `${year}-01-01`)
    .where("dueDate", "<", `${year + 1}-01-01`)
    .groupBy(monthKey)
    .execute();
}
function readCurrentOverdue(ledger: Ledger): Promise<Overdue> {
  return ledger
    .selectFrom("ledger")
    .select([
      sql<number>`coalesce(sum("collectibleBalanceCents"), 0)::double precision`.as("overdueCents"),
      sql<number>`count(distinct "payerId")::integer`.as("overduePayers"),
    ])
    .where("status", "=", "OVERDUE")
    .executeTakeFirstOrThrow();
}
function readPaymentMonths(
  database: FinanceDatabase,
  { year, asOf }: Period,
): Promise<PaymentMonth[]> {
  const paymentMonth = sql<string>`to_char(date, 'YYYY-MM')`;
  return database.$kysely
    .selectFrom("PaymentEntry")
    .select([
      paymentMonth.as("month"),
      sql<number>`sum(amount_cents)::double precision`.as("receivedCents"),
    ])
    .where("deleted_at", "is", null)
    .where("date", ">=", new Date(`${year}-01-01`))
    .where("date", "<", new Date(`${year + 1}-01-01`))
    .where("date", "<=", new Date(asOf))
    .groupBy(paymentMonth)
    .execute();
}
function aggregateAnalytics({
  year,
  asOf,
  charges,
  payments,
  overdue,
}: Period & {
  charges: ChargeMonth[];
  payments: PaymentMonth[];
  overdue: Overdue;
}): FinanceAnalytics {
  const totals = { expectedCents: 0, receivedCents: 0, maturedCents: 0, settledMaturedCents: 0 };
  for (const charge of charges) {
    totals.expectedCents += charge.expectedCents;
    totals.maturedCents += charge.maturedCents;
    totals.settledMaturedCents += charge.settledMaturedCents;
  }
  for (const payment of payments) totals.receivedCents += payment.receivedCents;
  const months = Array.from({ length: MONTHS_IN_YEAR }, (_unused, index) => {
    const month = `${year}-${String(index + 1).padStart(2, "0")}`;
    const charge = charges.find((row) => row.month === month);
    const payment = payments.find((row) => row.month === month);
    const row = {
      month,
      expectedCents: charge?.expectedCents ?? 0,
      receivedCents: payment?.receivedCents ?? 0,
      balanceCents: charge?.balanceCents ?? 0,
    };
    return row;
  });
  return {
    year,
    asOf,
    months,
    ...overdue,
    ...totals,
  };
}
