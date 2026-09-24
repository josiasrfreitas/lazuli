import type { DatabaseClient, KyselyDatabase } from "@lazuli/db";
import {
  FINANCE_OVERDUE_PAYERS_PAGE_SIZE,
  type FinanceInstallmentRow,
  type FinanceInstallmentsInput,
} from "@lazuli/validators";
import { type QueryCreator, type RawBuilder, type SelectExpression, sql } from "kysely";

type QueryInput = {
  kysely: DatabaseClient["$kysely"];
  businessDate: string;
  search: string | undefined;
} & Pick<
  FinanceInstallmentsInput,
  "statuses" | "dueFrom" | "dueTo" | "amountFromCents" | "amountToCents"
>;
type AggregateDatabase = KyselyDatabase & {
  adjustment_totals: { installment_id: string; amount_cents: number };
  allocation_totals: { installment_id: string; amount_cents: number };
  schedule_totals: { order_id: string; installment_count: number };
};
type LedgerDatabase = KyselyDatabase & { ledger: InstallmentQueryRow };
type OverdueDatabase = LedgerDatabase & {
  qualified_payers: { payerId: string };
  overdue: InstallmentQueryRow;
};
type PayerSummary = {
  payerId: string;
  payerName: string;
  installmentCount: number;
  groupBalanceCents: number;
  maxOverdueDays: number;
};
type SummaryDatabase = OverdueDatabase & { payer_summaries: PayerSummary };
export type OverdueQueryRow = InstallmentQueryRow &
  Pick<PayerSummary, "installmentCount" | "groupBalanceCents" | "maxOverdueDays">;
const BACKSLASH_CODE_POINT = 92;
type LedgerTables =
  | "Installment"
  | "Order"
  | "Payer"
  | "adjustment_totals"
  | "allocation_totals"
  | "schedule_totals";

export type InstallmentQueryRow = Omit<FinanceInstallmentRow, "payer" | "beneficiaries"> & {
  payerId: string;
  payerName: string;
  dueDateSort: string;
};

export async function loadInstallmentCounts(input: QueryInput): Promise<{
  all: number;
  paid: number;
  overdue: number;
}> {
  return overdueQuery(input)
    .selectFrom("ledger")
    .select([
      sql<number>`count(*) filter (where ${matchesSearch(input.search)} and ${matchesFilters(input)})::integer`.as(
        "all",
      ),
      sql<number>`count(*) filter (where status = 'PAID' and ${matchesSearch(input.search)} and ${matchesFilters(input)})::integer`.as(
        "paid",
      ),
      sql<number>`(select count(*)::integer from overdue)`.as("overdue"),
    ])
    .executeTakeFirstOrThrow();
}

export async function loadInstallmentPage(
  input: QueryInput & { view: "all" | "paid"; page: number; pageSize: number },
): Promise<InstallmentQueryRow[]> {
  let query = ledgerQuery(input)
    .selectFrom("ledger")
    .selectAll()
    .where(matchesSearch(input.search))
    .where(matchesFilters(input))
    .$if(input.view === "paid", (builder) => builder.where("status", "=", "PAID"));
  query =
    input.view === "paid"
      ? query.orderBy("dueDate", "desc").orderBy("installmentId", "asc")
      : query
          .orderBy(
            sql<number>`case when status = 'OVERDUE' then 0 when status in ('DUE_THIS_MONTH', 'UPCOMING') then 1 else 2 end`,
          )
          .orderBy(
            sql<string>`case when ${sql.ref("status")} in ('PAID', 'WAIVED') then ${sql.ref("dueDateSort")} end`,
            "desc",
          )
          .orderBy(
            sql<string>`case when ${sql.ref("status")} not in ('PAID', 'WAIVED') then ${sql.ref("dueDateSort")} end`,
            "asc",
          )
          .orderBy("installmentId", "asc");
  return query
    .limit(input.pageSize)
    .offset((input.page - 1) * input.pageSize)
    .execute();
}

function ledgerQuery(input: QueryInput): QueryCreator<LedgerDatabase> {
  const aggregates = aggregateQuery(input.kysely);
  const expected = sql<number>`"Installment".amount_cents + coalesce(adjustment_totals.amount_cents, 0)`;
  const paid = sql<number>`coalesce(allocation_totals.amount_cents, 0)`;
  const overdue = sql<number>`greatest(${input.businessDate}::date - "Installment".due_date, 0)`;
  const status = installmentStatus({ expected, paid, overdue, businessDate: input.businessDate });
  return aggregates.with("ledger", (database) => {
    const query = database
      .selectFrom("Installment")
      .innerJoin("Order", "Order.id", "Installment.order_id")
      .innerJoin("Payer", "Payer.id", "Order.payer_id")
      .innerJoin("schedule_totals", "schedule_totals.order_id", "Order.id")
      .leftJoin("adjustment_totals", "adjustment_totals.installment_id", "Installment.id")
      .leftJoin("allocation_totals", "allocation_totals.installment_id", "Installment.id")
      .select(ledgerSelection({ expected, paid, overdue, status }))
      .where("Installment.deleted_at", "is", null)
      .where("Order.deleted_at", "is", null)
      .where("Order.cancelled_at", "is", null)
      .where("Payer.deleted_at", "is", null);
    return query;
  }) as object as QueryCreator<LedgerDatabase>;
}

function aggregateQuery(kysely: DatabaseClient["$kysely"]): QueryCreator<AggregateDatabase> {
  return kysely
    .with("adjustment_totals", (database) =>
      database
        .selectFrom("InstallmentAdjustment")
        .select("installment_id")
        .select(sql<number>`sum(amount_cents)::integer`.as("amount_cents"))
        .where("deleted_at", "is", null)
        .groupBy("installment_id"),
    )
    .with("allocation_totals", (database) =>
      database
        .selectFrom("PaymentAllocation")
        .innerJoin("PaymentEntry", "PaymentEntry.id", "PaymentAllocation.payment_entry_id")
        .select("PaymentAllocation.installment_id")
        .select(sql<number>`sum("PaymentAllocation".amount_cents)::integer`.as("amount_cents"))
        .where("PaymentAllocation.deleted_at", "is", null)
        .where("PaymentEntry.deleted_at", "is", null)
        .groupBy("PaymentAllocation.installment_id"),
    )
    .with("schedule_totals", (database) =>
      database
        .selectFrom("Installment")
        .select("order_id")
        .select(sql<number>`count(*)::integer`.as("installment_count"))
        .where("deleted_at", "is", null)
        .groupBy("order_id"),
    );
}

function installmentStatus(input: {
  expected: RawBuilder<number>;
  paid: RawBuilder<number>;
  overdue: RawBuilder<number>;
  businessDate: string;
}): RawBuilder<FinanceInstallmentRow["status"]> {
  return sql<
    FinanceInstallmentRow["status"]
  >`case when "Installment".waived_at is not null then 'WAIVED' when ${input.paid} >= ${input.expected} then 'PAID' when ${input.overdue} > 0 then 'OVERDUE' when date_trunc('month', "Installment".due_date) = date_trunc('month', ${input.businessDate}::date) then 'DUE_THIS_MONTH' else 'UPCOMING' end`;
}

function ledgerSelection(input: {
  expected: RawBuilder<number>;
  paid: RawBuilder<number>;
  overdue: RawBuilder<number>;
  status: RawBuilder<FinanceInstallmentRow["status"]>;
}): ReadonlyArray<SelectExpression<AggregateDatabase, LedgerTables>> {
  return [
    "Installment.id as installmentId",
    "Order.id as orderId",
    "Order.kind as origin",
    "Installment.sequence_number as sequenceNumber",
    "schedule_totals.installment_count as scheduleTotal",
    "Payer.id as payerId",
    "Payer.name as payerName",
    sql<string>`to_char("Installment".due_date, 'YYYY-MM-DD')`.as("dueDate"),
    sql<string>`to_char("Installment".due_date, 'YYYY-MM-DD')`.as("dueDateSort"),
    "Installment.amount_cents as originalAmountCents",
    input.expected.as("expectedAmountCents"),
    input.paid.as("paidAmountCents"),
    sql<number>`case when "Installment".waived_at is not null then 0 else greatest(${input.expected} - ${input.paid}, 0) end`.as(
      "collectibleBalanceCents",
    ),
    input.status.as("status"),
    input.overdue.as("overdueDays"),
  ] as const;
}

function matchesSearch(search: string | undefined): RawBuilder<boolean> {
  if (search === undefined) return sql<boolean>`true`;
  const pattern = `%${escapeLikePattern(search)}%`;
  return sql<boolean>`
    ("payerName" ilike ${pattern} escape '\\' or exists (
        select 1 from "OrderBeneficiary" join "Student" on "Student".id = "OrderBeneficiary".student_id
        where "OrderBeneficiary".order_id = ledger."orderId"
          and "OrderBeneficiary".deleted_at is null and "Student".deleted_at is null
          and "Student".full_name ilike ${pattern} escape '\\'
      ))
  `;
}

function matchesFilters(input: QueryInput): RawBuilder<boolean> {
  const conditions: RawBuilder<boolean>[] = [];
  if (input.statuses?.length)
    conditions.push(sql<boolean>`ledger.status in (${sql.join(input.statuses)})`);
  if (input.dueFrom) conditions.push(sql<boolean>`ledger."dueDateSort" >= ${input.dueFrom}`);
  if (input.dueTo) conditions.push(sql<boolean>`ledger."dueDateSort" <= ${input.dueTo}`);
  if (input.amountFromCents !== undefined)
    conditions.push(sql<boolean>`ledger."originalAmountCents" >= ${input.amountFromCents}`);
  if (input.amountToCents !== undefined)
    conditions.push(sql<boolean>`ledger."originalAmountCents" <= ${input.amountToCents}`);
  return conditions.length > 0 ? sql.join(conditions, sql` and `) : sql<boolean>`true`;
}

function overdueQuery(input: QueryInput): QueryCreator<OverdueDatabase> {
  return ledgerQuery(input)
    .with("qualified_payers", (database) =>
      database
        .selectFrom("ledger")
        .select("payerId")
        .distinct()
        .where("status", "=", "OVERDUE")
        .where(matchesFilters(input))
        .where(matchesSearch(input.search)),
    )
    .with("overdue", (database) =>
      database
        .selectFrom("ledger")
        .selectAll()
        .where("status", "=", "OVERDUE")
        .where(matchesFilters(input))
        .where("payerId", "in", database.selectFrom("qualified_payers").select("payerId")),
    );
}

function overdueSummaries(input: QueryInput): QueryCreator<SummaryDatabase> {
  return overdueQuery(input).with("payer_summaries", (database) =>
    database
      .selectFrom("overdue")
      .select([
        "payerId",
        "payerName",
        sql<number>`count(*)::integer`.as("installmentCount"),
        sql<number>`sum("collectibleBalanceCents")::double precision`.as("groupBalanceCents"),
        sql<number>`max("overdueDays")::integer`.as("maxOverdueDays"),
      ])
      .groupBy(["payerId", "payerName"]),
  );
}

export async function loadOverdueTotal(input: QueryInput): Promise<number> {
  const result = await overdueSummaries(input)
    .selectFrom("payer_summaries")
    .select(sql<number>`count(*)::integer`.as("total"))
    .executeTakeFirstOrThrow();
  return result.total;
}

export async function loadOverduePage(
  input: QueryInput & { page: number },
): Promise<OverdueQueryRow[]> {
  return overdueSummaries(input)
    .with("selected_payers", (database) =>
      database
        .selectFrom("payer_summaries")
        .selectAll()
        .orderBy("maxOverdueDays", "desc")
        .orderBy("payerId", "asc")
        .limit(FINANCE_OVERDUE_PAYERS_PAGE_SIZE)
        .offset((input.page - 1) * FINANCE_OVERDUE_PAYERS_PAGE_SIZE),
    )
    .selectFrom("selected_payers")
    .innerJoin("overdue", "overdue.payerId", "selected_payers.payerId")
    .selectAll("overdue")
    .select([
      "selected_payers.installmentCount",
      "selected_payers.groupBalanceCents",
      "selected_payers.maxOverdueDays",
    ])
    .orderBy("selected_payers.maxOverdueDays", "desc")
    .orderBy("selected_payers.payerId", "asc")
    .orderBy("overdue.dueDate", "asc")
    .orderBy("overdue.installmentId", "asc")
    .execute();
}

function escapeLikePattern(value: string): string {
  const escape = String.fromCodePoint(BACKSLASH_CODE_POINT);
  return value
    .replaceAll(escape, escape.repeat(2))
    .replaceAll("%", `${escape}%`)
    .replaceAll("_", `${escape}_`);
}
