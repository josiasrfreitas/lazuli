import type { Prisma } from "@lazuli/db";
import { saoPauloDateOnly } from "@lazuli/domain";
import type { admissionEnrollSchema, z } from "@lazuli/validators";
import { badRequest } from "../trpc/errors.js";
import { createStudent } from "../students/data.js";
import { createEnrollment } from "../enrollment/data.js";
import { assertAllocatable, lockCandidate, matchingClasses, readCandidate } from "./candidates.js";

export async function enrollCandidate(input: {
  database: Prisma.TransactionClient;
  values: z.infer<typeof admissionEnrollSchema>;
  recordedById: string;
  now: Date;
}) {
  const { database, values, now, recordedById } = input;
  await lockCandidate(database, values.id);
  const candidate = await readCandidate(database, values.id);
  if (candidate.enrollmentId)
    return {
      studentId: candidate.studentId!,
      enrollmentId: candidate.enrollmentId,
      classId: candidate.enrollment!.classId,
    };
  assertAllocatable(candidate, values.date);
  if (values.date < saoPauloDateOnly(now)) throw badRequest("A entrada deve ser hoje ou futura.");
  const choices = await matchingClasses(database, values.id, values.date);
  const choice = choices.find((row) => row.id === values.classId);
  if (!choice)
    throw badRequest(
      "Turma incompatível com o estágio, a disponibilidade ou a modalidade. Atualize a seleção.",
    );
  if (
    candidate.studentId &&
    (values.student.mode !== "existing" || values.student.id !== candidate.studentId)
  )
    throw badRequest("Use o aluno já vinculado a este interessado.");
  const studentId =
    values.student.mode === "existing"
      ? values.student.id
      : (await createStudent({ database, values: values.student.values })).id;
  const created = await createEnrollment({
    database,
    staffUserId: recordedById,
    now,
    values: {
      studentId,
      classId: choice.id,
      entryDate: new Date(values.date),
      ...(choice.scheduleType === "PERSONALIZED" ? { stageId: candidate.stageId! } : {}),
    },
  });
  await database.admissionCandidate.update({
    where: { id: candidate.id },
    data: { status: "ENROLLED", studentId, enrollmentId: created.enrollment.id, recordedById },
  });
  return { studentId, enrollmentId: created.enrollment.id, classId: choice.id };
}
