import { saoPauloDateOnly, type StudentFinanceSummary } from "@lazuli/domain";
import { sql } from "kysely";
import { notFound } from "../../trpc/errors.js";
import { ledgerQuery } from "./installments-query.js";
import { STUDENT_NOT_FOUND_MESSAGE, type FinanceDatabase } from "./shared.js";
import { readStudentPaymentHistory } from "./student-summary-history.js";

type LedgerInput = Parameters<typeof ledgerQuery>[0];

export async function readStudentSummary(
  database: FinanceDatabase,
  input: { studentId: string; now: Date },
): Promise<StudentFinanceSummary & { asOf: string }> {
  const student = await database.student.findUnique({
    where: { id: input.studentId },
    select: { id: true },
  });
  if (!student) throw notFound(STUDENT_NOT_FOUND_MESSAGE);
  const asOf = saoPauloDateOnly(input.now);
  const query = {
    kysely: database.$kysely,
    businessDate: asOf,
    studentId: input.studentId,
    search: undefined,
  };
  const totals = await readTotals(query);
  const next = await ledgerQuery(query)
    .selectFrom("ledger")
    .select("dueDate")
    .select(sql<number>`sum("collectibleBalanceCents")::double precision`.as("amountCents"))
    .where("collectibleBalanceCents", ">", 0)
    .where("status", "!=", "OVERDUE")
    .groupBy("dueDate")
    .orderBy("dueDate", "asc")
    .limit(1)
    .executeTakeFirst();
  return {
    ...totals,
    asOf,
    totalCents: totals.receivedCents + totals.outstandingCents,
    debtState: debtState(totals),
    nextDueDate: next?.dueDate ?? null,
    nextDueCents: next?.amountCents ?? 0,
    history: await readStudentPaymentHistory(query),
  };
}

async function readTotals(
  input: LedgerInput,
): Promise<
  Pick<
    StudentFinanceSummary,
    | "installmentCount"
    | "receivedCents"
    | "outstandingCents"
    | "overdueCents"
    | "overdueCount"
    | "oldestOverdueDays"
  >
> {
  return ledgerQuery(input)
    .selectFrom("ledger")
    .select([
      sql<number>`count(*)::integer`.as("installmentCount"),
      sql<number>`coalesce(sum("paidAmountCents"), 0)::double precision`.as("receivedCents"),
      sql<number>`coalesce(sum("collectibleBalanceCents"), 0)::double precision`.as(
        "outstandingCents",
      ),
      sql<number>`coalesce(sum("collectibleBalanceCents") filter (where status = 'OVERDUE'), 0)::double precision`.as(
        "overdueCents",
      ),
      sql<number>`count(*) filter (where status = 'OVERDUE' and "collectibleBalanceCents" > 0)::integer`.as(
        "overdueCount",
      ),
      sql<number>`coalesce(max("overdueDays") filter (where status = 'OVERDUE' and "collectibleBalanceCents" > 0), 0)::integer`.as(
        "oldestOverdueDays",
      ),
    ])
    .executeTakeFirstOrThrow();
}

const SEVERE_OVERDUE_DAYS = 30;
function debtState(totals: {
  oldestOverdueDays: number;
  overdueCount: number;
}): StudentFinanceSummary["debtState"] {
  if (totals.oldestOverdueDays > SEVERE_OVERDUE_DAYS) return "SEVERE_OVERDUE";
  return totals.overdueCount > 0 ? "OVERDUE" : "NO_OVERDUE";
}
