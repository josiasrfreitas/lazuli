// Reuse the shared TRPCError factories so BAD_REQUEST / NOT_FOUND construction is defined once.
export { badRequest, notFound } from "../classes/errors.js";

export const MAKEUP_NOT_FOUND_MESSAGE = "Reposicao nao encontrada.";
export const ORIGIN_ENROLLMENT_NOT_FOUND_MESSAGE = "Matricula de origem nao encontrada.";
export const MAKEUP_TARGET_IN_PAST_MESSAGE =
  "Reposicao precisa ser agendada com antecedencia (a partir de amanha).";
export const MAKEUP_TARGET_CANCELLED_MESSAGE =
  "Nao e possivel usar uma sessao cancelada como destino de reposicao.";
export const MAKEUP_SAME_CLASS_MESSAGE =
  "A turma de destino e igual a de origem; informe um motivo para registrar a excecao.";
export const MAKEUP_DUPLICATE_MESSAGE = "Ja existe uma reposicao para esta matricula nesta sessao.";
export const MAKEUP_ALREADY_CANCELLED_MESSAGE = "Reposicao ja esta cancelada.";
export const MAKEUP_ALREADY_ATTENDED_MESSAGE =
  "Reposicao ja tem presenca registrada e nao pode ser cancelada.";
