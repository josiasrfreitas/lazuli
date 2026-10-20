import type { StudentFinanceSummary } from "@lazuli/domain";
import { sql } from "kysely";
import { ledgerQuery } from "./installments-query.js";

type History = StudentFinanceSummary["history"];
type LedgerInput = Parameters<typeof ledgerQuery>[0];

const HISTORY_SELECTION = [
  sql<number>`count(*)::integer`.as("settledCount"),
  sql<number>`count(*) filter (where "lateDays" = 0)::integer`.as("onTimeCount"),
  sql<number>`count(*) filter (where "lateDays" > 0)::integer`.as("lateCount"),
  sql<number>`count(distinct left("dueDate", 7)) filter (where "lateDays" > 0)::integer`.as(
    "settledLateMonths",
  ),
  sql<number | null>`round(avg("lateDays") filter (where "lateDays" > 0))::integer`.as(
    "averageLateDays",
  ),
  sql<number>`
    (select count(distinct month)::integer from (
            select left("dueDate", 7) as month from settlements where "lateDays" > 0
            union all
            select left("dueDate", 7) as month from ledger
              where status = 'OVERDUE' and "collectibleBalanceCents" > 0
          ) months)
  `.as("lateMonths"),
] as const;

/** Aggregate the payment completing each adjusted balance inside PostgreSQL. */
export async function readStudentPaymentHistory(input: LedgerInput): Promise<History> {
  const result = await ledgerQuery(input)
    .with("dated_payments", (database) =>
      database
        .selectFrom("ledger")
        .innerJoin("PaymentAllocation", "PaymentAllocation.installment_id", "ledger.installmentId")
        .innerJoin("PaymentEntry", "PaymentEntry.id", "PaymentAllocation.payment_entry_id")
        .select([
          "ledger.installmentId",
          "ledger.dueDate",
          "ledger.expectedAmountCents",
          "PaymentEntry.date as paidDate",
          sql<number>`
            sum("PaymentAllocation".amount_cents) over (
                        partition by ledger."installmentId"
                        order by "PaymentEntry".date, "PaymentAllocation".id
                        rows between unbounded preceding and current row
                      )
          `.as("accumulatedCents"),
        ])
        .where("ledger.status", "=", "PAID")
        .where("ledger.expectedAmountCents", ">", 0)
        .where("PaymentAllocation.deleted_at", "is", null)
        .where("PaymentEntry.deleted_at", "is", null),
    )
    .with("settlements", (database) =>
      database
        .selectFrom("dated_payments")
        .select(["installmentId", "dueDate"])
        .select(sql<number>`greatest(min("paidDate") - "dueDate"::date, 0)::integer`.as("lateDays"))
        .whereRef("accumulatedCents", ">=", "expectedAmountCents")
        .groupBy(["installmentId", "dueDate"]),
    )
    .selectFrom("settlements")
    .select(HISTORY_SELECTION)
    .executeTakeFirstOrThrow();
  return { ...result, paymentState: paymentState(result) };
}

function paymentState(history: {
  settledLateMonths: number;
  settledCount: number;
}): History["paymentState"] {
  if (history.settledLateMonths > 1) return "RECURRING_DELAY";
  if (history.settledLateMonths === 1) return "OCCASIONAL_DELAY";
  return history.settledCount > 0 ? "ON_TIME" : "INSUFFICIENT_HISTORY";
}
