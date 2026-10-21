import type { Prisma } from "@lazuli/db";
import { saoPauloDateOnly } from "@lazuli/domain";
import { badRequest } from "../trpc/errors.js";

// Enrollment exit dates are exclusive, matching the student pedagogy read model.
// A student's ACTIVE registration status or an open contract is not an enrollment.
export async function requireCurrentEnrollment(
  context: { database: Prisma.TransactionClient; now: Date },
  studentId: string,
): Promise<void> {
  const today = new Date(saoPauloDateOnly(context.now));
  const enrollment = await context.database.enrollment.findFirst({
    where: {
      studentId,
      deletedAt: null,
      class: { deletedAt: null },
      entryDate: { lte: today },
      OR: [{ exitDate: null }, { exitDate: { gt: today } }],
    },
    select: { id: true },
  });
  if (!enrollment)
    throw badRequest(
      "O aluno está sem matrícula vigente. Organize a matrícula antes de registrar novas atividades pedagógicas.",
    );
}
