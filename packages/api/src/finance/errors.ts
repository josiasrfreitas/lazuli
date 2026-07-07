import { TRPCError } from "@trpc/server";

export { badRequest, notFound } from "../classes/errors.js";

export const PAYER_NOT_FOUND_MESSAGE = "Pagador nao encontrado.";
export const STUDENT_NOT_FOUND_MESSAGE = "Aluno nao encontrado.";
export const ORDER_NOT_FOUND_MESSAGE = "Pedido nao encontrado.";
export const ORDER_LOCKED_MESSAGE =
  "Pedido bloqueado para edicao: ja possui pagamento, isencao ou ajuste registrado.";

export function orderLocked(): TRPCError {
  return new TRPCError({ code: "BAD_REQUEST", message: ORDER_LOCKED_MESSAGE });
}
