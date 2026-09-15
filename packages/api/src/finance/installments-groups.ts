import type { FinanceOverduePayerGroup, FinanceInstallmentRow } from "@lazuli/validators";

type InstallmentGroupRow = Omit<FinanceInstallmentRow, "payer" | "beneficiaries"> & {
  payerId: string;
  payerName: string;
  dueDateSort: string;
};

export type OverdueGroupRow = InstallmentGroupRow & {
  installmentCount: number;
  groupBalanceCents: number;
  maxOverdueDays: number;
};

export type LoadedBeneficiaries = {
  byOrder: Map<string, FinanceInstallmentRow["beneficiaries"]>;
  ordered: FinanceInstallmentRow["beneficiaries"];
};

export function toPublicRow(
  row: InstallmentGroupRow,
  beneficiaries: LoadedBeneficiaries,
): FinanceInstallmentRow {
  return {
    installmentId: row.installmentId,
    orderId: row.orderId,
    sequenceNumber: row.sequenceNumber,
    scheduleTotal: row.scheduleTotal,
    payer: { id: row.payerId, name: row.payerName },
    beneficiaries: beneficiaries.byOrder.get(row.orderId) ?? [],
    dueDate: row.dueDate,
    originalAmountCents: row.originalAmountCents,
    expectedAmountCents: row.expectedAmountCents,
    paidAmountCents: row.paidAmountCents,
    collectibleBalanceCents: row.collectibleBalanceCents,
    status: row.status,
    overdueDays: row.overdueDays,
  };
}

type OverdueGroupRows = Omit<FinanceOverduePayerGroup, "beneficiaries">;
type OverduePublicRow = FinanceOverduePayerGroup["rows"][number];

export function groupOverdueRows(
  rows: OverdueGroupRow[],
  beneficiaries: LoadedBeneficiaries,
): FinanceOverduePayerGroup[] {
  const groups = new Map<string, OverdueGroupRows>();
  for (const row of rows) {
    let group = groups.get(row.payerId);
    if (!group) {
      group = {
        payer: { id: row.payerId, name: row.payerName },
        installmentCount: row.installmentCount,
        collectibleBalanceCents: row.groupBalanceCents,
        maxOverdueDays: row.maxOverdueDays,
        rows: [],
      };
      groups.set(row.payerId, group);
    }
    // The overdue CTE filters these rows by status; keep the runtime value so the output schema
    // still rejects a query regression instead of coercing it to OVERDUE here.
    group.rows.push(toPublicRow(row, beneficiaries) as OverduePublicRow);
  }
  return [...groups.values()].map((group) => {
    const studentIds = new Set(
      group.rows.flatMap((row) => row.beneficiaries.map((student) => student.studentId)),
    );
    return {
      ...group,
      beneficiaries: [
        ...new Map(
          beneficiaries.ordered
            .filter((student) => studentIds.has(student.studentId))
            .map((student) => [student.studentId, student]),
        ).values(),
      ],
    };
  });
}
