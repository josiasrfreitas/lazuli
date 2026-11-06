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
  loadGroupedPage,
  loadGroupedTotal,
} from "./installments-query.js";
import {
  groupOverdueRows,
  groupPayerRows,
  type LoadedBeneficiaries,
  toPublicRow,
} from "../installments-groups.js";
import type { FinanceDatabase } from "./shared.js";

type InstallmentsResponseBody = Omit<Extract<FinanceInstallmentsOutput, { view: "all" }>, "view">;
const STUDENT_NAME_COLUMN = "Student.full_name";
const STUDENT_ID_COLUMN = "Student.id";

export async function listInstallments(input: {
  database: FinanceDatabase;
  values: FinanceInstallmentsInput;
  now: Date;
}): Promise<FinanceInstallmentsOutput> {
  const queryInput = installmentQueryInput(input);
  const counts = await loadInstallmentCounts(queryInput);
  if (input.values.view === "overdue") {
    return listOverdueInstallments({
      database: input.database,
      queryInput,
      page: input.values.page,
      counts,
    });
  }
  if (input.values.view === "grouped") {
    return listGroupedInstallments({
      database: input.database,
      queryInput,
      page: input.values.page,
      counts,
    });
  }
  const { studentFilter, total } = studentInitialFilter(input.values, counts);
  if (input.values.studentFilter === "auto" && studentFilter === "overdue")
    queryInput.statuses = ["OVERDUE"];
  const rows = await loadInstallmentPage({
    ...queryInput,
    view: input.values.view,
    page: input.values.page,
    pageSize: input.values.pageSize,
  });
  const [beneficiaries, paymentMethodNames] = await Promise.all([
    loadBeneficiaries(
      input.database,
      rows.map((row) => row.orderId),
    ),
    loadPaymentMethodNames(
      input.database,
      rows.filter((row) => row.status === "PAID").map((row) => row.installmentId),
    ),
  ]);
  const response: InstallmentsResponseBody = {
    rows: rows.map((row) => ({
      ...toPublicRow(row, beneficiaries),
      ...(paymentMethodNames.has(row.installmentId)
        ? { paymentMethodNames: paymentMethodNames.get(row.installmentId) }
        : {}),
    })),
    page: input.values.page,
    pageSize: input.values.pageSize,
    total,
    pageCount: Math.ceil(total / input.values.pageSize),
    counts,
  };
  return input.values.view === "paid"
    ? { view: "paid", ...response }
    : { view: "all", ...response, ...(studentFilter ? { studentFilter } : {}) };
}

async function loadPaymentMethodNames(
  database: FinanceDatabase,
  installmentIds: string[],
): Promise<Map<string, string[]>> {
  if (installmentIds.length === 0) return new Map();
  const allocations = await database.paymentAllocation.findMany({
    where: {
      installmentId: { in: installmentIds },
      deletedAt: null,
      paymentEntry: { is: { deletedAt: null } },
    },
    select: {
      installmentId: true,
      paymentEntry: { select: { paymentMethod: { select: { name: true } } } },
      amountCents: true,
      reversals: {
        where: { deletedAt: null, reversal: { deletedAt: null } },
        select: { amountCents: true },
      },
    },
  });
  const methods = new Map<string, Set<string>>();
  for (const allocation of allocations) {
    if (
      allocation.amountCents <=
      allocation.reversals.reduce((total, reversal) => total + reversal.amountCents, 0)
    )
      continue;
    const names = methods.get(allocation.installmentId) ?? new Set<string>();
    names.add(allocation.paymentEntry.paymentMethod.name);
    methods.set(allocation.installmentId, names);
  }
  const result = new Map<string, string[]>();
  for (const [installmentId, names] of methods)
    result.set(
      installmentId,
      [...names].toSorted((left, right) => left.localeCompare(right, "pt-BR")),
    );
  return result;
}

function installmentQueryInput(
  input: Parameters<typeof listInstallments>[0],
): Parameters<typeof loadInstallmentCounts>[0] {
  return {
    kysely: input.database.$kysely,
    businessDate: saoPauloDateOnly(input.now),
    search: input.values.search,
    studentId: input.values.studentId,
    statuses: installmentStatuses(input.values),
    origins: input.values.origins,
    dueFrom: input.values.dueFrom,
    dueTo: input.values.dueTo,
    amountFromCents: input.values.amountFromCents,
    amountToCents: input.values.amountToCents,
  };
}

function installmentStatuses(
  values: FinanceInstallmentsInput,
): FinanceInstallmentsInput["statuses"] {
  if (values.studentFilter === "overdue") return ["OVERDUE"];
  if (values.studentFilter === "paid") return ["PAID"];
  return values.view === "overdue" ? undefined : values.statuses;
}

function studentInitialFilter(
  values: FinanceInstallmentsInput,
  counts: Awaited<ReturnType<typeof loadInstallmentCounts>>,
): { studentFilter: Exclude<FinanceInstallmentsInput["studentFilter"], "auto">; total: number } {
  if (values.studentFilter === "auto") {
    const studentFilter = counts.overdue > 0 ? "overdue" : "all";
    return { studentFilter, total: studentFilter === "overdue" ? counts.overdue : counts.all };
  }
  return {
    studentFilter: values.studentFilter,
    total: values.view === "paid" ? counts.paid : counts.all,
  };
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

async function listGroupedInstallments(input: {
  database: FinanceDatabase;
  queryInput: Omit<Parameters<typeof loadGroupedPage>[0], "page">;
  page: number;
  counts: FinanceInstallmentsOutput["counts"];
}): Promise<Extract<FinanceInstallmentsOutput, { view: "grouped" }>> {
  const { database, queryInput, page, counts } = input;
  const total = await loadGroupedTotal(queryInput);
  const rows = await loadGroupedPage({ ...queryInput, page });
  const beneficiaries = await loadBeneficiaries(
    database,
    rows.map((row) => row.orderId),
  );
  return {
    view: "grouped",
    groups: groupPayerRows(rows, beneficiaries),
    page,
    pageSize: FINANCE_OVERDUE_PAYERS_PAGE_SIZE,
    total,
    pageCount: Math.ceil(total / FINANCE_OVERDUE_PAYERS_PAGE_SIZE),
    counts,
  };
}
