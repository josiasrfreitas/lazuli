import { TRPCError } from "@trpc/server";

const STUDENT_NOT_FOUND_MESSAGE = "Aluno nao encontrado.";
const CLASS_NOT_FOUND_MESSAGE = "Turma nao encontrada.";
const ARTIFACT_NOT_FOUND_MESSAGE = "Artefato nao encontrado.";

export function reportNotFound(resource: "student" | "class" | "artifact"): never {
  if (resource === "student") {
    throw new TRPCError({ code: "NOT_FOUND", message: STUDENT_NOT_FOUND_MESSAGE });
  }

  if (resource === "class") {
    throw new TRPCError({ code: "NOT_FOUND", message: CLASS_NOT_FOUND_MESSAGE });
  }

  throw new TRPCError({ code: "NOT_FOUND", message: ARTIFACT_NOT_FOUND_MESSAGE });
}

export function reportForbidden(): never {
  throw new TRPCError({
    code: "FORBIDDEN",
    message: "Voce nao tem permissao para solicitar este relatorio.",
  });
}
