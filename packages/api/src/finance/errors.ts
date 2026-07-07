import { TRPCError } from "@trpc/server";

export { badRequest, notFound } from "../classes/errors.js";

export const PAYER_NOT_FOUND_MESSAGE = "Pagador nao encontrado.";
export const STUDENT_NOT_FOUND_MESSAGE = "Aluno nao encontrado.";
export const ORDER_NOT_FOUND_MESSAGE = "Pedido nao encontrado.";
export const INSTALLMENT_NOT_FOUND_MESSAGE = "Parcela nao encontrada.";
export const INSTALLMENT_PAYER_MISMATCH_MESSAGE = "Parcela pertence a outro pagador.";
export const ENTRY_OVER_ALLOCATION_MESSAGE = "Soma das alocacoes excede o valor do pagamento.";
export const INSTALLMENT_OVER_ALLOCATION_MESSAGE = "Alocacao excede o saldo atual da parcela.";
export const WAIVED_INSTALLMENT_ALLOCATION_MESSAGE = "Parcela isenta nao aceita alocacao.";
export const ORDER_LOCKED_MESSAGE =
  "Pedido bloqueado para edicao: ja possui pagamento, isencao ou ajuste registrado.";
export const INSTALLMENT_ALREADY_WAIVED_MESSAGE = "Parcela ja esta isenta.";
export const INSTALLMENT_NOTHING_TO_WAIVE_MESSAGE =
  "Parcela sem saldo remanescente para isentar.";
export const CANCELLED_ORDER_INSTALLMENT_MESSAGE =
  "Pedido cancelado nao aceita alteracoes financeiras.";
export const WAIVED_INSTALLMENT_ADJUSTMENT_MESSAGE =
  "Parcela isenta nao aceita ajuste.";
export const INVALID_ADJUSTMENT_SIGN_MESSAGE = "Sinal do ajuste invalido para o tipo informado.";
export const DISCOUNT_REASON_REQUIRED_MESSAGE = "Desconto exige motivo.";
export const ADJUSTMENT_BELOW_ZERO_MESSAGE = "Ajuste deixaria valor esperado negativo.";
export const ADJUSTMENT_BELOW_PAID_MESSAGE =
  "Ajuste deixaria valor esperado menor que o ja pago.";

export function orderLocked(): TRPCError {
  return new TRPCError({ code: "BAD_REQUEST", message: ORDER_LOCKED_MESSAGE });
}
