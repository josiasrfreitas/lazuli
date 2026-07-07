import type { InstallmentLedger } from "@lazuli/domain";

import {
  loadDerivedReceivablesInstallments,
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

  const rows = derivedInstallments
    .filter(
      (installment) =>
        installment.isCollectible &&
        installment.ledger.status === "OVERDUE" &&
        installment.ledger.collectibleRemainingCents > 0,
    )
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate))
    .map((installment) => ({
      installmentId: installment.id,
      orderId: installment.orderId,
      payer: installment.payer,
      beneficiaries: installment.beneficiaries,
      dueDate: installment.dueDate,
      ledger: installment.ledger,
    }));

  return { rows };
}
