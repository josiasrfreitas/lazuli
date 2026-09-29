import {
  deriveInstallmentLedger,
  type DeriveOrderLedgerInput,
  type InstallmentLedger,
} from "./finance-ledger.js";
import { saoPauloDateOnly } from "./session-time.js";

export type ContractFinancialStatus =
  | "INADIMPLENTE"
  | "EM_DIA"
  | "QUITADO"
  | "SEM_SALDO"
  | "CANCELADO";
export type ContractServiceStatus = "NOT_STARTED" | "ACTIVE" | "ENDED";

export type ContractFinancialSummary = {
  overdueCents: number;
  dueTodayCents: number;
  futureCents: number;
  zeroedByAdjustment: number;
};

export function deriveContractServiceStatus(input: {
  startsOn: string;
  endsOn: string;
  now: Date;
}): ContractServiceStatus {
  const today = saoPauloDateOnly(input.now);
  if (today < input.startsOn) return "NOT_STARTED";
  return today > input.endsOn ? "ENDED" : "ACTIVE";
}

/** Only registered adjustments and allocations count; previews never become debt. */
export function deriveContractFinancialSummary(
  input: Omit<DeriveOrderLedgerInput, "interestRatePctMonthly"> & { installmentCount: number },
): {
  status: ContractFinancialStatus;
  paymentProgress: { paid: number; total: number; waived: number; cancelled: number };
  financialSummary: ContractFinancialSummary;
} {
  const today = saoPauloDateOnly(input.now);
  const ledgers = input.installments.map((installment) => ({
    ...deriveInstallmentLedger({
      ...installment,
      orderCancelledAt: input.cancelledAt,
      now: input.now,
      interestRatePctMonthly: 0,
    }),
    dueDate:
      typeof installment.dueDate === "string"
        ? installment.dueDate
        : installment.dueDate.toISOString(),
  }));
  const paid = ledgers.filter(
    (ledger) => ledger.status === "PAID" && ledger.paidAmountCents > 0,
  ).length;
  const waived = ledgers.filter((ledger) => ledger.status === "WAIVED").length;
  const financialSummary = registeredBalances(ledgers, today);
  return {
    status: financialStatus({
      cancelled: input.cancelledAt !== null,
      fullyPaid: input.installmentCount > 0 && paid === input.installmentCount,
      summary: financialSummary,
    }),
    paymentProgress: {
      paid,
      total: input.installmentCount,
      waived,
      cancelled: input.cancelledAt === null ? 0 : ledgers.length - paid - waived,
    },
    financialSummary,
  };
}

function financialStatus(input: {
  cancelled: boolean;
  fullyPaid: boolean;
  summary: ContractFinancialSummary;
}): ContractFinancialStatus {
  if (input.cancelled) return "CANCELADO";
  if (input.summary.overdueCents > 0) return "INADIMPLENTE";
  if (input.fullyPaid) return "QUITADO";
  return input.summary.dueTodayCents + input.summary.futureCents === 0 ? "SEM_SALDO" : "EM_DIA";
}

function registeredBalances(
  ledgers: Array<InstallmentLedger & { dueDate: string }>,
  today: string,
): ContractFinancialSummary {
  const financialSummary: ContractFinancialSummary = {
    overdueCents: 0,
    dueTodayCents: 0,
    futureCents: 0,
    zeroedByAdjustment: ledgers.filter(
      (ledger) => ledger.status === "PAID" && ledger.paidAmountCents === 0,
    ).length,
  };
  for (const ledger of ledgers) {
    const dateOnly = ledger.dueDate.slice(0, today.length);
    const balance = ledger.collectibleRemainingCents;
    if (dateOnly < today) financialSummary.overdueCents += balance;
    else if (dateOnly === today) financialSummary.dueTodayCents += balance;
    else financialSummary.futureCents += balance;
  }
  return financialSummary;
}
