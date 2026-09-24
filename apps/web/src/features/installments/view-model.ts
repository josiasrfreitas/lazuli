import type { BadgeVariant } from "@lazuli/ui";
import type { FinanceInstallmentRow, FinanceOverduePayerGroup } from "@lazuli/validators";

import { formatBRLFromCents } from "~/lib/format";
export { saoPauloDateOnly as businessDate } from "@lazuli/domain";
type InstallmentVm = {
  sequence: string;
  origin: string;
  dueDate: string;
  amount: string;
  balance: string | null;
  badge: { label: string; variant: BadgeVariant };
};

type OverduePayerSummaryVm = {
  description: string;
  balance: string;
};

function countLabel(count: number, labels: readonly [singular: string, plural: string]): string {
  return `${count} ${count === 1 ? labels[0] : labels[1]}`;
}

export function abbreviatedPersonName(fullName: string): string {
  const [firstName, secondName] = fullName.trim().split(/\s+/u);
  return secondName === undefined ? (firstName ?? "") : `${firstName} ${secondName.charAt(0)}.`;
}

export function overduePayerSummaryVm(group: FinanceOverduePayerGroup): OverduePayerSummaryVm {
  return {
    description: [
      countLabel(group.installmentCount, ["parcela vencida", "parcelas vencidas"]),
      countLabel(group.beneficiaries.length, ["aluno", "alunos"]),
      `mais antiga há ${countLabel(group.maxOverdueDays, ["dia", "dias"])}`,
    ].join(" · "),
    balance: formatBRLFromCents(group.collectibleBalanceCents),
  };
}
export function installmentVm(row: FinanceInstallmentRow, today: string): InstallmentVm {
  const [year, month, day] = row.dueDate.split("-");
  return {
    sequence: `${row.sequenceNumber} de ${row.scheduleTotal}`,
    origin: {
      TUITION: "Mensalidade",
      ENROLLMENT_FEE: "Taxa de matrícula",
      MATERIAL: "Material",
      OTHER: "Outro",
    }[row.origin],
    dueDate: `${day}/${month}/${year}`,
    amount: formatBRLFromCents(row.originalAmountCents),
    balance:
      row.paidAmountCents > 0 && row.collectibleBalanceCents > 0
        ? `Restante: ${formatBRLFromCents(row.collectibleBalanceCents)}`
        : null,
    badge: statusBadge(row, today),
  };
}
function statusBadge(
  row: FinanceInstallmentRow,
  today: string,
): { label: string; variant: BadgeVariant } {
  switch (row.status) {
    case "PAID": {
      return { label: "Paga", variant: "success" };
    }
    case "WAIVED": {
      return { label: "Dispensada", variant: "neutral" };
    }
    case "OVERDUE": {
      return {
        label: `Vencida há ${row.overdueDays} ${row.overdueDays === 1 ? "dia" : "dias"}`,
        variant: "destructive",
      };
    }
    default: {
      return row.dueDate === today
        ? { label: "Vence hoje", variant: "warning" }
        : { label: "A vencer", variant: "neutral" };
    }
  }
}
