import { sql } from "kysely";
import { saoPauloDateOnly } from "@lazuli/domain";
import { ledgerQuery } from "./installments-query.js";
import type { FinanceDatabase } from "./shared.js";

const MONTHS_IN_YEAR = 12;
const AGING_LABELS = ["1–30 dias", "31–60 dias", "61–90 dias", "Mais de 90 dias"];
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
  methods: { method: string; label: string; receivedCents: number; count: number }[];
  aging: { label: string; balanceCents: number; count: number }[];
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
  const payments = await readPaymentAnalytics(database, { year: input.year, asOf });
  const aging = await readAging(ledger);
  return {
    ...aggregateAnalytics({ year: input.year, asOf, charges, payments: payments.months, overdue }),
    methods: payments.methods,
    aging,
  };
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
async function readPaymentAnalytics(
  database: FinanceDatabase,
  { year, asOf }: Period,
): Promise<{ months: PaymentMonth[]; methods: FinanceAnalytics["methods"] }> {
  const start = new Date(`${year}-01-01T00:00:00.000Z`);
  const end = new Date(`${year + 1}-01-01T00:00:00.000Z`);
  const movements = await database.$queryRaw<
    Array<{
      month: string;
      method: string;
      receivedCents: number;
    }>
  >`
    WITH movements AS (
      SELECT p.date AS effective_date, p.method, p.amount_cents AS amount_cents
      FROM "PaymentEntry" p WHERE p.deleted_at IS NULL
      UNION ALL
      SELECT CASE WHEN r.kind = 'CANCELLATION' THEN p.date ELSE r.occurred_on END,
        p.method, -r.amount_cents
      FROM payment_reversals r
      JOIN "PaymentEntry" p ON p.id = r.payment_entry_id
      WHERE r.deleted_at IS NULL AND p.deleted_at IS NULL
    )
    SELECT to_char(effective_date, 'YYYY-MM') AS month, method,
      SUM(amount_cents)::double precision AS "receivedCents"
    FROM movements
    WHERE effective_date >= ${start}::date AND effective_date < ${end}::date
      AND effective_date <= ${new Date(`${asOf}T00:00:00.000Z`)}::date
    GROUP BY month, method
  `;
  const monthsByMonth = new Map<string, number>();
  const methodsByCode = new Map<string, number>();
  for (const row of movements) {
    monthsByMonth.set(row.month, (monthsByMonth.get(row.month) ?? 0) + row.receivedCents);
    methodsByCode.set(row.method, (methodsByCode.get(row.method) ?? 0) + row.receivedCents);
  }
  const months = [...monthsByMonth].map(([month, receivedCents]) => ({ month, receivedCents }));
  const counts = await database.$queryRaw<Array<{ method: string; count: number }>>`
    SELECT p.method, COUNT(*)::integer AS count
    FROM "PaymentEntry" p
    WHERE p.deleted_at IS NULL AND p.date >= ${start}::date AND p.date < ${end}::date
      AND p.date <= ${new Date(`${asOf}T00:00:00.000Z`)}::date
      AND p.amount_cents > COALESCE((
        SELECT SUM(r.amount_cents) FROM payment_reversals r
        WHERE r.payment_entry_id = p.id AND r.deleted_at IS NULL
      ), 0)
    GROUP BY p.method
  `;
  const countByCode = new Map(counts.map((row) => [row.method, row.count]));
  const methods = [...methodsByCode]
    .map(([method, receivedCents]) => ({
      method,
      receivedCents,
      count: countByCode.get(method) ?? 0,
    }))
    .toSorted((a, b) => b.receivedCents - a.receivedCents || a.method.localeCompare(b.method));
  const catalog = await database.paymentMethod.findMany({
    where: { code: { in: methods.map((row) => row.method) } },
    select: { code: true, name: true },
  });
  const labels = new Map(catalog.map((row) => [row.code, row.name]));
  return {
    months,
    methods: methods.map((row) => ({ ...row, label: labels.get(row.method) ?? row.method })),
  };
}
async function readAging(ledger: Ledger): Promise<FinanceAnalytics["aging"]> {
  const bucket = sql<number>`case when "overdueDays" <= 30 then 0 when "overdueDays" <= 60 then 1 when "overdueDays" <= 90 then 2 else 3 end`;
  const amounts = await ledger
    .selectFrom("ledger")
    .select([
      bucket.as("bucket"),
      sql<number>`sum("collectibleBalanceCents")::double precision`.as("balanceCents"),
      sql<number>`count(*)::integer`.as("count"),
    ])
    .where("status", "=", "OVERDUE")
    .groupBy(bucket)
    .execute();
  return AGING_LABELS.map((label, index) => {
    const amount = amounts.find((row) => row.bucket === index);
    return { label, balanceCents: amount?.balanceCents ?? 0, count: amount?.count ?? 0 };
  });
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
}): Omit<FinanceAnalytics, "methods" | "aging"> {
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
