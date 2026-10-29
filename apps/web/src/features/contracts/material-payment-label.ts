import { materialInstallmentPlan } from "@lazuli/domain";
import { formatBRLFromCents as money } from "~/lib/format";

export function materialPaymentLabel(totalCents: number, count: number): string {
  const plan = materialInstallmentPlan(totalCents, count);
  return plan.installmentCents === plan.lastInstallmentCents
    ? `${count} × ${money(plan.installmentCents)}`
    : `${count - 1} × ${money(plan.installmentCents)} + 1 × ${money(plan.lastInstallmentCents)}`;
}
