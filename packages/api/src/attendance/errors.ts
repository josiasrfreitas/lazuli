// Reuse the shared TRPCError factories so BAD_REQUEST / NOT_FOUND construction is defined once.
export { badRequest, notFound } from "../classes/errors.js";

export const SESSION_NOT_FOUND_MESSAGE = "Sessao nao encontrada.";
export const ENROLLMENT_NOT_FOUND_MESSAGE = "Matricula nao encontrada.";
export const SEMESTER_NOT_FOUND_MESSAGE = "Semestre nao encontrado.";
export const SESSION_CANCELLED_MESSAGE = "Sessao cancelada nao aceita chamada.";
export const ALREADY_CONFIRMED_MESSAGE = "Chamada desta sessao ja foi confirmada.";
export const ATTENDANCE_NOT_CONFIRMED_MESSAGE = "Chamada desta sessao ainda nao foi confirmada.";
export const ENROLLMENT_NOT_ON_ROSTER_MESSAGE =
  "Matricula nao pertence a lista de presenca desta sessao.";
export const DUPLICATE_ROSTER_ROW_MESSAGE = "Matricula repetida na chamada.";
export const ROSTER_COUNT_MISMATCH_MESSAGE = "Divergencia na contagem da lista de presenca.";
