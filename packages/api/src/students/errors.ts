import { TRPCError } from "@trpc/server";

export const STUDENT_NOT_FOUND_MESSAGE = "Aluno nao encontrado.";
export const GUARDIAN_NOT_FOUND_MESSAGE = "Responsavel nao encontrado.";

export function badRequest(message: string): TRPCError {
  return new TRPCError({ code: "BAD_REQUEST", message });
}

export function notFound(message: string): TRPCError {
  return new TRPCError({ code: "NOT_FOUND", message });
}
