import type { FinanceInstallmentRow } from "@lazuli/validators";

export type InstallmentSituation = FinanceInstallmentRow["status"];
export type InstallmentColumnMode = "standard" | "unpaid" | "paid" | "waived";

export function installmentColumnMode(
  situations: readonly InstallmentSituation[],
): InstallmentColumnMode {
  if (situations.length !== 1) return "standard";
  if (situations[0] === "PAID") return "paid";
  if (situations[0] === "WAIVED") return "waived";
  return "unpaid";
}
