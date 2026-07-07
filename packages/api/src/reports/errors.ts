import { TRPCError } from "@trpc/server";

export function reportNotFound(resource: "student" | "class" | "artifact"): never {
  const message =
    resource === "student"
      ? "Aluno nao encontrado."
      : resource === "class"
        ? "Turma nao encontrada."
        : "Artefato nao encontrado.";

  throw new TRPCError({ code: "NOT_FOUND", message });
}

export function reportForbidden(): never {
  throw new TRPCError({
    code: "FORBIDDEN",
    message: "Voce nao tem permissao para solicitar este relatorio.",
  });
}
