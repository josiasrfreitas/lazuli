import { saoPauloDateOnly } from "@lazuli/domain";
import {
  FINANCE_INSTALLMENTS_PAGE_SIZE,
  type FinanceInstallmentRow,
  type FinanceInstallmentsInput,
  type FinanceInstallmentsOutput,
} from "@lazuli/validators";

import {
  loadInstallmentCounts,
  loadInstallmentPage,
  type InstallmentQueryRow,
} from "./installments-query.js";
import type { FinanceDatabase } from "./shared.js";

type InstallmentsResponseBody = Omit<Extract<FinanceInstallmentsOutput, { view: "all" }>, "view">;

export async function listInstallments(input: {
  database: FinanceDatabase;
  values: FinanceInstallmentsInput;
  now: Date;
}): Promise<FinanceInstallmentsOutput> {
  const queryInput = {
    kysely: input.database.$kysely,
    businessDate: saoPauloDateOnly(input.now),
    search: input.values.search === "" ? undefined : input.values.search,
  };
  const counts = await loadInstallmentCounts(queryInput);
  const total = input.values.view === "paid" ? counts.paid : counts.all;
  const rows = await loadInstallmentPage({
    ...queryInput,
    view: input.values.view,
    page: input.values.page,
  });
  const beneficiaries = await loadBeneficiaries(
    input.database,
    rows.map((row) => row.orderId),
  );
  const response: InstallmentsResponseBody = {
    rows: rows.map((row) => toPublicRow(row, beneficiaries)),
    page: input.values.page,
    pageSize: FINANCE_INSTALLMENTS_PAGE_SIZE,
    total,
    pageCount: Math.ceil(total / FINANCE_INSTALLMENTS_PAGE_SIZE),
    counts,
  };
  return input.values.view === "paid"
    ? { view: "paid", ...response }
    : { view: "all", ...response };
}

function toPublicRow(
  row: InstallmentQueryRow,
  beneficiaries: Map<string, FinanceInstallmentRow["beneficiaries"]>,
): FinanceInstallmentRow {
  return {
    installmentId: row.installmentId,
    orderId: row.orderId,
    sequenceNumber: row.sequenceNumber,
    scheduleTotal: row.scheduleTotal,
    payer: { id: row.payerId, name: row.payerName },
    beneficiaries: beneficiaries.get(row.orderId) ?? [],
    dueDate: row.dueDate,
    originalAmountCents: row.originalAmountCents,
    expectedAmountCents: row.expectedAmountCents,
    paidAmountCents: row.paidAmountCents,
    collectibleBalanceCents: row.collectibleBalanceCents,
    status: row.status,
    overdueDays: row.overdueDays,
  };
}

async function loadBeneficiaries(
  database: FinanceDatabase,
  orderIds: string[],
): Promise<Map<string, FinanceInstallmentRow["beneficiaries"]>> {
  if (orderIds.length === 0) return new Map();
  const rows = await database.$kysely
    .selectFrom("OrderBeneficiary")
    .innerJoin("Student", "Student.id", "OrderBeneficiary.student_id")
    .select([
      "OrderBeneficiary.order_id as orderId",
      "Student.id as studentId",
      "Student.full_name as fullName",
    ])
    .where("OrderBeneficiary.order_id", "in", orderIds)
    .where("OrderBeneficiary.deleted_at", "is", null)
    .where("Student.deleted_at", "is", null)
    .orderBy("Student.full_name", "asc")
    .orderBy("Student.id", "asc")
    .execute();
  const byOrder = new Map<string, FinanceInstallmentRow["beneficiaries"]>();
  for (const row of rows) {
    const existing = byOrder.get(row.orderId) ?? [];
    existing.push({ studentId: row.studentId, fullName: row.fullName });
    byOrder.set(row.orderId, existing);
  }
  return byOrder;
}
