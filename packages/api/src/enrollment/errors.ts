// Shared TRPCError factories live with the classes router; reuse them so the BAD_REQUEST /
// NOT_FOUND construction is defined once.
export { badRequest, notFound } from "../classes/errors.js";

export const STUDENT_NOT_FOUND_MESSAGE = "Aluno nao encontrado.";
export const STUDENT_NOT_ACTIVE_MESSAGE = "Somente alunos ativos podem ser matriculados.";
export const CLASS_NOT_FOUND_MESSAGE = "Turma nao encontrada.";
export const CLASS_ARCHIVED_MESSAGE = "Turma arquivada nao aceita novas matriculas.";
export const CAPACITY_OVERRIDE_REQUIRED_MESSAGE =
  "Turma sem vagas: informe um motivo para exceder a capacidade.";
export const PERSONALIZED_REQUIRES_STAGE_MESSAGE = "Turma personalizada exige etapa inicial.";
export const REGULAR_REJECTS_STAGE_MESSAGE = "Turma regular define a etapa automaticamente.";
export const REGULAR_CLASS_MISSING_STAGE_MESSAGE = "Turma regular sem etapa configurada.";
export const DUPLICATE_ACTIVE_ENROLLMENT_MESSAGE =
  "Aluno ja possui matricula ativa nesta turma.";
