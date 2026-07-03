import { TRPCError } from "@trpc/server";

export const CLASS_NOT_FOUND_MESSAGE = "Turma nao encontrada.";
export const CLASS_NOT_ACTIVE_MESSAGE = "Somente turmas ativas podem ser clonadas.";
export const TEACHER_INVALID_MESSAGE = "Professor invalido ou inativo.";
export const LEGACY_TRACK_MESSAGE = "Nao e possivel criar turma em trilha legada.";
export const END_OF_TRACK_MESSAGE = "Fim da trilha: nao ha proxima etapa.";
export const PORTAL_NAME_COLLISION_MESSAGE =
  "Nao foi possivel gerar um nome Portal unico para a turma.";
export const STAGE_NOT_FOUND_MESSAGE = "Etapa nao encontrada.";
export const SEMESTER_NOT_FOUND_MESSAGE = "Semestre nao encontrado.";

export function badRequest(message: string): TRPCError {
  return new TRPCError({ code: "BAD_REQUEST", message });
}

export function notFound(message: string): TRPCError {
  return new TRPCError({ code: "NOT_FOUND", message });
}
