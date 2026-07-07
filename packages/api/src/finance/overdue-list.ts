import type { InstallmentLedger } from "@lazuli/domain";

import {
  loadDerivedReceivablesInstallments,
  type DerivedReceivablesInstallment,
  type ReceivablesDatabase,
} from "./receivables-data.js";

export type OverdueListRow = {
  installmentId: string;
  orderId: string;
  payer: { id: string; name: string };
  beneficiaries: Array<{ studentId: string; fullName: string; whatsAppUrl: string | null }>;
  dueDate: string;
  ledger: InstallmentLedger;
};

export type OverdueListResult = {
  rows: OverdueListRow[];
};

export async function overdueList(input: {
  database: ReceivablesDatabase;
}): Promise<OverdueListResult> {
  const derivedInstallments = await loadDerivedReceivablesInstallments(input.database);

  const overdueInstallments = derivedInstallments.filter(
    (installment) =>
      installment.isCollectible &&
      installment.ledger.status === "OVERDUE" &&
      installment.ledger.collectibleRemainingCents > 0,
  );

  const rows = sortInstallmentsByDueDate(overdueInstallments).map((installment) => ({
    installmentId: installment.id,
    orderId: installment.orderId,
    payer: installment.payer,
    beneficiaries: installment.beneficiaries,
    dueDate: installment.dueDate,
    ledger: installment.ledger,
  }));

  return { rows };
}

function sortInstallmentsByDueDate(
  installments: DerivedReceivablesInstallment[],
): DerivedReceivablesInstallment[] {
  let sortedInstallments: DerivedReceivablesInstallment[] = [];

  for (const installment of installments) {
    const insertionIndex = sortedInstallments.findIndex(
      (sortedInstallment) => sortedInstallment.dueDate > installment.dueDate,
    );

    if (insertionIndex === -1) {
      sortedInstallments = [...sortedInstallments, installment];
      continue;
    }

    sortedInstallments = [
      ...sortedInstallments.slice(0, insertionIndex),
      installment,
      ...sortedInstallments.slice(insertionIndex),
    ];
  }

  return sortedInstallments;
}
