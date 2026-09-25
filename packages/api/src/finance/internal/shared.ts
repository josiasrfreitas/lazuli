import type { DatabaseClient } from "@lazuli/db";
import { TRPCError } from "@trpc/server";

export { badRequest, notFound } from "../../classes/errors.js";

export const PAYER_NOT_FOUND_MESSAGE = "Pagador nao encontrado.";
export const STUDENT_NOT_FOUND_MESSAGE = "Aluno nao encontrado.";
export const ORDER_NOT_FOUND_MESSAGE = "Pedido nao encontrado.";
export const INSTALLMENT_NOT_FOUND_MESSAGE = "Parcela nao encontrada.";
export const INSTALLMENT_PAYER_MISMATCH_MESSAGE = "Parcela pertence a outro pagador.";
export const ENTRY_OVER_ALLOCATION_MESSAGE = "Soma das alocacoes excede o valor do pagamento.";
export const INSTALLMENT_OVER_ALLOCATION_MESSAGE = "Alocacao excede o saldo atual da parcela.";
export const WAIVED_INSTALLMENT_ALLOCATION_MESSAGE = "Parcela isenta nao aceita alocacao.";
export const CONTRACT_OPERATION_UNAVAILABLE_MESSAGE = "Operacao contratual ainda indisponivel.";
export const ORDER_LOCKED_MESSAGE =
  "Pedido bloqueado para edicao: ja possui pagamento, isencao ou ajuste registrado.";
export const INSTALLMENT_ALREADY_WAIVED_MESSAGE = "Parcela ja esta isenta.";
export const INSTALLMENT_NOTHING_TO_WAIVE_MESSAGE = "Parcela sem saldo remanescente para isentar.";
export const CANCELLED_ORDER_INSTALLMENT_MESSAGE =
  "Pedido cancelado nao aceita alteracoes financeiras.";
export const WAIVED_INSTALLMENT_ADJUSTMENT_MESSAGE = "Parcela isenta nao aceita ajuste.";
export const INVALID_ADJUSTMENT_SIGN_MESSAGE = "Sinal do ajuste invalido para o tipo informado.";
export const DISCOUNT_REASON_REQUIRED_MESSAGE = "Desconto exige motivo.";
export const ADJUSTMENT_BELOW_ZERO_MESSAGE = "Ajuste deixaria valor esperado negativo.";
export const ADJUSTMENT_BELOW_PAID_MESSAGE = "Ajuste deixaria valor esperado menor que o ja pago.";

export function orderLocked(): TRPCError {
  return new TRPCError({ code: "BAD_REQUEST", message: ORDER_LOCKED_MESSAGE });
}

/** Every delegate the finance module touches; both PrismaClient and a transaction client satisfy it. */
export type FinanceDatabase = Pick<
  DatabaseClient,
  | "$kysely"
  | "$queryRaw"
  | "$executeRaw"
  | "address"
  | "guardian"
  | "payer"
  | "order"
  | "orderBeneficiary"
  | "installment"
  | "installmentAdjustment"
  | "paymentEntry"
  | "paymentAllocation"
  | "student"
  | "financeSettings"
  | "contract"
>;

const DATE_ONLY_LENGTH = 10;

export function toDateOnlyString(value: Date): string {
  return value.toISOString().slice(0, DATE_ONLY_LENGTH);
}

export function toDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export const DEFAULT_INTEREST_RATE_PCT_MONTHLY = 1;

export function loadInterestRatePctMonthly(database: FinanceDatabase): Promise<number> {
  // Existing orders have no contractual rate snapshot. Keep their historical preview stable.
  void database;
  return Promise.resolve(DEFAULT_INTEREST_RATE_PCT_MONTHLY);
}

export function sortStrings(values: string[]): string[] {
  let sortedValues: string[] = [];

  for (const value of values) {
    const insertionIndex = sortedValues.findIndex((sortedValue) => sortedValue > value);

    if (insertionIndex === -1) {
      sortedValues = [...sortedValues, value];
      continue;
    }

    sortedValues = [
      ...sortedValues.slice(0, insertionIndex),
      value,
      ...sortedValues.slice(insertionIndex),
    ];
  }

  return sortedValues;
}
