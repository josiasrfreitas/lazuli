// Shared TRPCError factories live with the classes router; reuse them so the BAD_REQUEST /
// NOT_FOUND construction is defined once. END_OF_TRACK_MESSAGE is shared with the REGULAR
// clone flow (S-CLS-1), which also surfaces "fim da trilha".
export { badRequest, notFound, END_OF_TRACK_MESSAGE } from "../classes/errors.js";

export const STUDENT_NOT_FOUND_MESSAGE = "Aluno nao encontrado.";
export const STUDENT_NOT_ACTIVE_MESSAGE = "Somente alunos ativos podem ser matriculados.";
export const CLASS_NOT_FOUND_MESSAGE = "Turma nao encontrada.";
export const CLASS_ARCHIVED_MESSAGE = "Turma arquivada nao aceita novas matriculas.";
export const CAPACITY_OVERRIDE_REQUIRED_MESSAGE =
  "Turma sem vagas: informe um motivo para exceder a capacidade.";
export const PERSONALIZED_REQUIRES_STAGE_MESSAGE = "Turma personalizada exige etapa inicial.";
export const REGULAR_REJECTS_STAGE_MESSAGE = "Turma regular define a etapa automaticamente.";
export const REGULAR_CLASS_MISSING_STAGE_MESSAGE = "Turma regular sem etapa configurada.";
export const DUPLICATE_ACTIVE_ENROLLMENT_MESSAGE = "Aluno ja possui matricula ativa nesta turma.";
export const ENROLLMENT_NOT_FOUND_MESSAGE = "Matricula nao encontrada.";
export const ENROLLMENT_NOT_ACTIVE_MESSAGE = "Somente matriculas ativas podem avancar de etapa.";
export const ADVANCE_REQUIRES_PERSONALIZED_MESSAGE =
  "Apenas turmas personalizadas avancam de etapa individualmente; turmas regulares avancam pela clonagem de turma.";
export const ACTIVE_PROGRESS_NOT_FOUND_MESSAGE = "Matricula ativa sem etapa ativa.";
export const ENROLLMENT_ALREADY_CLOSED_MESSAGE = "Matricula ja encerrada.";
export const TRANSFER_SAME_CLASS_MESSAGE = "A turma de destino deve ser diferente da turma atual.";
