import type { TransactionClient } from "@lazuli/db";
import { saoPauloDateOnly } from "@lazuli/domain";
import type { admissionEnrollSchema, z } from "@lazuli/validators";
import { lockTeacher } from "../teachers/availability.js";
import { badRequest } from "../trpc/errors.js";
import { createStudent } from "../students/data.js";
import { createEnrollment, type EnrollmentDatabase } from "../enrollment/data.js";
import {
  assertAllocatable,
  lockCandidate,
  matchingClasses,
  readCandidate,
  type AdmissionCandidate,
} from "./candidates.js";

type EnrollmentInput = {
  database: TransactionClient;
  values: z.infer<typeof admissionEnrollSchema>;
  recordedById: string;
  now: Date;
};
type EnrollmentResult = { studentId: string; enrollmentId: string; classId: string };
export async function enrollCandidate(input: EnrollmentInput): Promise<EnrollmentResult> {
  const { database, values, now, recordedById } = input;
  const enrollmentDatabase = captureEnrollmentTransaction(database);
  await lockTeacher(database, "");
  await lockCandidate(database, values.id);
  const candidate = await readCandidate(database, values.id);
  if (candidate.enrollmentId)
    return {
      studentId: candidate.studentId!,
      enrollmentId: candidate.enrollmentId,
      classId: candidate.enrollment!.classId,
    };
  const choice = await enrollmentChoice(input, candidate);
  const studentId = await enrollmentStudent(input);
  const created = await createEnrollment({
    database: enrollmentDatabase,
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

async function enrollmentStudent({ database, values, now }: EnrollmentInput): Promise<string> {
  if (values.student.mode === "existing") {
    const student = await database.student.findFirst({
      where: { id: values.student.id, deletedAt: null },
      select: { id: true },
    });
    if (!student) throw badRequest("Aluno não encontrado. Atualize a seleção.");
    return student.id;
  }
  const birthDate = values.student.values.birthDate;
  if (birthDate && birthDate > new Date(saoPauloDateOnly(now)))
    throw badRequest("A data de nascimento não pode ser futura.");
  const student = await createStudent({ database, values: values.student.values });
  return student.id;
}

/** Capture the extension's query builder before another concurrent transaction can replace it. */
function captureEnrollmentTransaction(database: TransactionClient): EnrollmentDatabase {
  return {
    $kysely: database.$kysely,
    $queryRaw: database.$queryRaw.bind(database),
    enrollment: database.enrollment,
    pedagogicalProgress: database.pedagogicalProgress,
    class: database.class,
    student: database.student,
    stage: database.stage,
    semester: database.semester,
    track: database.track,
    user: database.user,
    enrollmentAction: database.enrollmentAction,
  };
}

async function enrollmentChoice(
  { database, values, now }: EnrollmentInput,
  candidate: AdmissionCandidate,
): Promise<Awaited<ReturnType<typeof matchingClasses>>[number]> {
  assertAllocatable(candidate, values.date);
  if (values.date < saoPauloDateOnly(now)) throw badRequest("A entrada deve ser hoje ou futura.");
  const choices = await matchingClasses(database, { id: values.id, date: values.date });
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
  return choice;
}
