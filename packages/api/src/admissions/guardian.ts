import type { Prisma } from "@lazuli/db";
import type { admissionEnrollSchema, z } from "@lazuli/validators";
import { badRequest } from "../trpc/errors.js";

/** The declared minor path still requires a guardian when birth date is not yet known. */
export async function requireLeadGuardian(
  database: Prisma.TransactionClient,
  candidate: { contactRole: string },
  student: z.infer<typeof admissionEnrollSchema>["student"],
) {
  if (candidate.contactRole !== "GUARDIAN") return;
  const reference = student.mode === "create" ? student.values.guardian : null;
  const existing =
    student.mode === "existing"
      ? await database.student.findFirst({
          where: { id: student.id, deletedAt: null },
          include: { guardian: true },
        })
      : null;
  const guardian =
    existing?.guardian ??
    (reference?.mode === "create"
      ? reference.input
      : reference?.mode === "connect"
        ? await database.guardian.findFirst({ where: { id: reference.id, deletedAt: null } })
        : null);
  if (!guardian?.fullName || (!guardian.phone && !guardian.email))
    throw badRequest("Informe nome e telefone ou e-mail do responsável para matricular o menor.");
}
