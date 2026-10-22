import { randomUUID } from "node:crypto";
import type { Prisma } from "@lazuli/db";
import type { makeupScheduleInputSchema, z } from "@lazuli/validators";
import type { StaffUser } from "../trpc/context.js";
import { badRequest, notFound } from "../trpc/errors.js";
import { lockTeacher } from "../teachers/availability.js";
import { scheduleAppointment } from "../appointments/schedule.js";
type MakeupValues = z.infer<typeof makeupScheduleInputSchema>;

/** Compatibility entry point; source validation and responsibility use the appointment service. */
export async function scheduleMakeup(input: {
  database: Prisma.TransactionClient;
  staffUser: StaffUser;
  values: MakeupValues;
  now?: Date;
}): Promise<{
  makeupId: `${string}-${string}-${string}-${string}-${string}`;
  originEnrollmentId: string;
  targetClassSessionId: string;
  scheduledAt: Date;
}> {
  const { database, values } = input;
  const now = input.now ?? new Date();
  await lockTeacher(database, "");
  const origin = await validMakeupOrigin(database, values);
  const makeupId = randomUUID();
  await database.makeup.create({
    data: {
      id: makeupId,
      originEnrollmentId: origin.id,
      targetClassSessionId: values.targetClassSessionId,
      scheduledById: input.staffUser.id,
      scheduledAt: now,
      reason: values.reason ?? null,
    },
  });
  await scheduleAppointment(
    { database, staffUser: input.staffUser, now },
    {
      input: {
        id: makeupId,
        studentId: origin.studentId,
        enrollmentId: origin.id,
        purpose: "MAKEUP",
        meeting: { kind: "CLASS", sessionId: values.targetClassSessionId },
        coverages: values.coverages,
        plannedContent: values.plannedContent,
        notes: values.reason ?? "",
      },
      rescheduledFromId: undefined,
      legacyMakeupId: makeupId,
    },
  );
  return {
    makeupId,
    originEnrollmentId: origin.id,
    targetClassSessionId: values.targetClassSessionId,
    scheduledAt: now,
  };
}

async function validMakeupOrigin(
  database: Prisma.TransactionClient,
  values: MakeupValues,
): Promise<Prisma.EnrollmentGetPayload<Record<string, never>>> {
  const origin = await database.enrollment.findUnique({ where: { id: values.originEnrollmentId } });
  if (!origin) throw notFound("Matrícula de origem não encontrada.");
  const target = await database.classSession.findUnique({
    where: { id: values.targetClassSessionId },
  });
  if (!target) throw notFound("Aula de destino não encontrada.");
  if (
    await database.makeup.findFirst({
      where: { originEnrollmentId: origin.id, targetClassSessionId: target.id, deletedAt: null },
    })
  )
    throw badRequest("Já existe uma reposição para esta matrícula e aula.");
  const sources = await database.attendance.findMany({
    where: { id: { in: values.coverages.map((row) => row.attendanceId) }, enrollmentId: origin.id },
  });
  if (sources.length !== values.coverages.length)
    throw badRequest("As faltas devem pertencer à matrícula de origem.");
  return origin;
}
