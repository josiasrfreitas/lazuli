import type { BadgeVariant } from "@lazuli/ui";
import type { FinanceInstallmentRow, FinanceOverduePayerGroup } from "@lazuli/validators";

import { formatBRLFromCents } from "~/lib/format";
export { saoPauloDateOnly as businessDate } from "@lazuli/domain";
type InstallmentVm = {
  sequence: string;
  origin: string;
  dueDate: string;
  badge: { label: string; variant: BadgeVariant; description?: string };
};

export type InstallmentAmountVm = {
  nominal: string;
  paid: string;
  discount: string | null;
};

const PERCENTAGE_SCALE = 100;
const percentageFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

function discountPercentage(nominal: number, discounted: number): string {
  return percentageFormatter.format(((nominal - discounted) / nominal) * PERCENTAGE_SCALE);
}

export function installmentAmountVm(row: FinanceInstallmentRow): InstallmentAmountVm {
  return {
    nominal: formatBRLFromCents(row.originalAmountCents),
    paid: row.paidAmountCents > 0 ? formatBRLFromCents(row.paidAmountCents) : "—",
    discount:
      row.paidAmountCents > 0 && row.expectedAmountCents < row.originalAmountCents
        ? `Desconto aplicado: ${discountPercentage(row.originalAmountCents, row.expectedAmountCents)}%`
        : null,
  };
}

type OverduePayerSummaryVm = {
  description: string;
  balance: string;
};

function countLabel(count: number, labels: readonly [singular: string, plural: string]): string {
  return `${count} ${count === 1 ? labels[0] : labels[1]}`;
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
    origin: originLabel(row.origin),
    dueDate: `${day}/${month}/${year}`,
    badge: statusBadge(row, today),
  };
}

export function originLabel(origin: FinanceInstallmentRow["origin"]): string {
  return {
    TUITION: "Mensalidade",
    ENROLLMENT_FEE: "Taxa de matrícula",
    MATERIAL: "Material",
    OTHER: "Outro",
  }[origin];
}
function statusBadge(row: FinanceInstallmentRow, today: string): InstallmentVm["badge"] {
  switch (row.status) {
    case "PAID": {
      return { label: "Paga", variant: "success" };
    }
    case "WAIVED": {
      return { label: "Dispensada", variant: "neutral" };
    }
    case "OVERDUE": {
      const overdue = `Vencida há ${row.overdueDays} ${row.overdueDays === 1 ? "dia" : "dias"}`;
      return row.paidAmountCents > 0
        ? { label: "Parcial · Vencida", variant: "destructive", description: overdue }
        : { label: `Vencida · ${row.overdueDays}d`, variant: "destructive", description: overdue };
    }
    default: {
      if (row.paidAmountCents > 0) return { label: "Parcial", variant: "warning" };
      return row.dueDate === today
        ? { label: "Vence hoje", variant: "warning" }
        : { label: "A vencer", variant: "neutral" };
    }
  }
}
