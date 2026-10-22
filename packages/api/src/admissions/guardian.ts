import type { Prisma } from "@lazuli/db";
import type { admissionEnrollSchema, z } from "@lazuli/validators";
import { badRequest } from "../trpc/errors.js";

/** The declared minor path still requires a guardian when birth date is not yet known. */
export async function requireLeadGuardian(
  database: Prisma.TransactionClient,
  options: {
    candidate: {
      contactRole: string;
    };
    student: z.infer<typeof admissionEnrollSchema>["student"];
  },
): Promise<void> {
  const { candidate, student } = options;

  if (candidate.contactRole !== "GUARDIAN") return;
  if (student.mode === "existing") {
    const existing = await database.student.findFirst({
      where: { id: student.id, deletedAt: null },
      include: { guardian: true },
    });
    assertGuardianContact(existing?.guardian);
    return;
  }
  const reference = student.values.guardian;
  if (reference?.mode === "create") {
    assertGuardianContact(reference.input);
    return;
  }
  const guardian =
    reference?.mode === "connect"
      ? await database.guardian.findFirst({ where: { id: reference.id, deletedAt: null } })
      : null;
  assertGuardianContact(guardian);
}

function assertGuardianContact(
  guardian:
    | {
        fullName?: string | null;
        phone?: string | null | undefined;
        email?: string | null | undefined;
      }
    | null
    | undefined,
): void {
  if (!guardian?.fullName || (!guardian.phone && !guardian.email))
    throw badRequest("Informe nome e telefone ou e-mail do responsável para matricular o menor.");
}
