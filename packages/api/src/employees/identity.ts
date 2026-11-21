import type { Prisma } from "@lazuli/db";
import { badRequest } from "../trpc/errors.js";
type AssertUniqueIdentityInput = {
  database: Prisma.TransactionClient;
  values: { cpf: string; email: string };
  exceptId?: string;
};

export async function assertUniqueIdentity({
  database,
  values,
  exceptId,
}: AssertUniqueIdentityInput): Promise<void> {
  const [emailOwner, cpfOwner] = await Promise.all([
    database.user.findFirst({
      where: {
        email: { equals: values.email, mode: "insensitive" },
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      select: { id: true },
    }),
    database.employeeProfile.findUnique({ where: { cpf: values.cpf }, select: { userId: true } }),
  ]);
  if (emailOwner || (cpfOwner && cpfOwner.userId !== exceptId))
    throw badRequest("CPF ou e-mail já cadastrado. Localize a identidade existente.");
}
