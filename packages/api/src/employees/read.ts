import { TRPCError } from "@trpc/server";
import type { Prisma } from "@lazuli/db";
import { notFound } from "../trpc/errors.js";
import { teacherSelect } from "../teachers/read.js";

export async function readEmployee(
  database: Prisma.TransactionClient,
  id: string,
): Promise<Prisma.UserGetPayload<{ select: typeof teacherSelect }>> {
  const employee = await database.user.findFirst({
    where: { id, deletedAt: null, employeeProfile: { is: { deletedAt: null } } },
    select: teacherSelect,
  });
  if (!employee) throw notFound("Colaborador não encontrado.");
  return employee;
}

export function requireEmployeeEditor(targetRole: string, actorRole?: string): void {
  if (targetRole === "SUPER_ADMIN" && actorRole !== "SUPER_ADMIN")
    throw new TRPCError({ code: "FORBIDDEN" });
  if (targetRole === "SYSTEM_ADMIN" && actorRole !== "SUPER_ADMIN" && actorRole !== "SYSTEM_ADMIN")
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Somente um administrador do sistema pode alterar este cadastro.",
    });
}
