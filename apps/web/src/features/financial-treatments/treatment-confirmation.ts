import type { FinancialTreatmentConfirm } from "@lazuli/validators";

export class TreatmentConfirmation {
  pending = false;
  uncertain = false;
  private command: FinancialTreatmentConfirm | undefined;

  get locked(): boolean {
    return this.pending || this.uncertain;
  }
  begin(command: FinancialTreatmentConfirm): FinancialTreatmentConfirm | undefined {
    if (this.pending) return undefined;
    this.pending = true;
    this.command ??= command;
    return this.command;
  }
  reject(code?: string): void {
    this.pending = false;
    const definitive = code === "BAD_REQUEST" || code === "CONFLICT" || code === "FORBIDDEN";
    this.uncertain ||= !definitive;
    if (!this.uncertain) this.command = undefined;
  }
  complete(): void {
    this.pending = false;
    this.uncertain = false;
    this.command = undefined;
  }
}
