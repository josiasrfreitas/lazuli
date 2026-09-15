import type { BadgeVariant } from "@lazuli/ui";
import type { FinanceInstallmentRow } from "@lazuli/validators";

import { formatBRLFromCents } from "~/lib/format";
export { saoPauloDateOnly as businessDate } from "@lazuli/domain";
type InstallmentVm = {
  sequence: string;
  dueDate: string;
  amount: string;
  balance: string | null;
  badge: { label: string; variant: BadgeVariant };
};
export function installmentVm(row: FinanceInstallmentRow, today: string): InstallmentVm {
  const [year, month, day] = row.dueDate.split("-");
  return {
    sequence: `${String(row.sequenceNumber).padStart(2, "0")}/${String(row.scheduleTotal).padStart(2, "0")}`,
    dueDate: `${day}/${month}/${year}`,
    amount: formatBRLFromCents(row.originalAmountCents),
    balance:
      row.paidAmountCents > 0 && row.collectibleBalanceCents > 0
        ? `Saldo em aberto: ${formatBRLFromCents(row.collectibleBalanceCents)}`
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
