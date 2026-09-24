import { saoPauloDateOnly } from "@lazuli/domain";
import {
  FINANCE_OVERDUE_PAYERS_PAGE_SIZE,
  type FinanceInstallmentRow,
  type FinanceInstallmentsInput,
  type FinanceInstallmentsOutput,
} from "@lazuli/validators";
import { sql } from "kysely";

import {
  loadOverduePage,
  loadOverdueTotal,
  loadInstallmentCounts,
  loadInstallmentPage,
} from "./installments-query.js";
import { groupOverdueRows, type LoadedBeneficiaries, toPublicRow } from "../installments-groups.js";
import type { FinanceDatabase } from "./shared.js";

type InstallmentsResponseBody = Omit<Extract<FinanceInstallmentsOutput, { view: "all" }>, "view">;
const STUDENT_NAME_COLUMN = "Student.full_name";
const STUDENT_ID_COLUMN = "Student.id";

export async function listInstallments(input: {
  database: FinanceDatabase;
  values: FinanceInstallmentsInput;
  now: Date;
}): Promise<FinanceInstallmentsOutput> {
  const queryInput = {
    kysely: input.database.$kysely,
    businessDate: saoPauloDateOnly(input.now),
    search: input.values.search,
    statuses: input.values.view === "overdue" ? undefined : input.values.statuses,
    dueFrom: input.values.dueFrom,
    dueTo: input.values.dueTo,
    amountFromCents: input.values.amountFromCents,
    amountToCents: input.values.amountToCents,
  };
  const counts = await loadInstallmentCounts(queryInput);
  if (input.values.view === "overdue") {
    return listOverdueInstallments({
      database: input.database,
      queryInput,
      page: input.values.page,
      counts,
    });
  }
  const total = input.values.view === "paid" ? counts.paid : counts.all;
  const rows = await loadInstallmentPage({
    ...queryInput,
    view: input.values.view,
    page: input.values.page,
    pageSize: input.values.pageSize,
  });
  const beneficiaries = await loadBeneficiaries(
    input.database,
    rows.map((row) => row.orderId),
  );
  const response: InstallmentsResponseBody = {
    rows: rows.map((row) => toPublicRow(row, beneficiaries)),
    page: input.values.page,
    pageSize: input.values.pageSize,
    total,
    pageCount: Math.ceil(total / input.values.pageSize),
    counts,
  };
  return input.values.view === "paid"
    ? { view: "paid", ...response }
    : { view: "all", ...response };
}

async function loadBeneficiaries(
  database: FinanceDatabase,
  orderIds: string[],
): Promise<LoadedBeneficiaries> {
  if (orderIds.length === 0) {
    return { byOrder: new Map(), ordered: [] };
  }

  const rows = await database.$kysely
    .selectFrom("OrderBeneficiary")
    .innerJoin("Student", STUDENT_ID_COLUMN, "OrderBeneficiary.student_id")
    .select([
      "OrderBeneficiary.order_id as orderId",
      sql<string>`"Student".id`.as("studentId"),
      "Student.full_name as fullName",
    ])
    .where("OrderBeneficiary.order_id", "in", orderIds)
    .where("OrderBeneficiary.deleted_at", "is", null)
    .where("Student.deleted_at", "is", null)
    .orderBy(STUDENT_NAME_COLUMN, "asc")
    .orderBy(STUDENT_ID_COLUMN, "asc")
    .execute();
  const contractualRows = await database.$kysely
    .selectFrom("Order")
    .innerJoin("Contract", "Contract.id", "Order.contract_id")
    .innerJoin("Student", STUDENT_ID_COLUMN, "Contract.student_id")
    .select([
      "Order.id as orderId",
      sql<string>`"Student".id`.as("studentId"),
      "Student.full_name as fullName",
    ])
    .where("Order.id", "in", orderIds)
    .where("Student.deleted_at", "is", null)
    .orderBy(STUDENT_NAME_COLUMN, "asc")
    .orderBy(STUDENT_ID_COLUMN, "asc")
    .execute();
  const byOrder = new Map<string, FinanceInstallmentRow["beneficiaries"]>();
  for (const row of [...rows, ...contractualRows]) {
    const existing = byOrder.get(row.orderId) ?? [];
    existing.push({ studentId: row.studentId, fullName: row.fullName });
    byOrder.set(row.orderId, existing);
  }
  return {
    byOrder,
    ordered: [...rows, ...contractualRows].map(({ studentId, fullName }) => ({
      studentId,
      fullName,
    })),
  };
}

async function listOverdueInstallments(input: {
  database: FinanceDatabase;
  queryInput: Omit<Parameters<typeof loadOverduePage>[0], "page">;
  page: number;
  counts: FinanceInstallmentsOutput["counts"];
}): Promise<Extract<FinanceInstallmentsOutput, { view: "overdue" }>> {
  const { database, queryInput, page, counts } = input;
  const total = await loadOverdueTotal(queryInput);
  const rows = await loadOverduePage({ ...queryInput, page });
  const beneficiaries = await loadBeneficiaries(
    database,
    rows.map((row) => row.orderId),
  );
  return {
    view: "overdue",
    groups: groupOverdueRows(rows, beneficiaries),
    page,
    pageSize: FINANCE_OVERDUE_PAYERS_PAGE_SIZE,
    total,
    pageCount: Math.ceil(total / FINANCE_OVERDUE_PAYERS_PAGE_SIZE),
    counts,
  };
}
