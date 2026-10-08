import { createHash } from "node:crypto";
import type { Prisma } from "@lazuli/db";
import { saoPauloDateOnly, sessionEndInstant } from "@lazuli/domain";
import { badRequest, notFound } from "../trpc/errors.js";
import { freezeStartedMeetings } from "./freeze-today.js";
import { lockTeacher } from "./availability.js";
import { meetingsBetween } from "./schedule.js";
import { responsibilitySelect, usualTeacherOn } from "./responsibility.js";

type Departure = {
  database: Prisma.TransactionClient;
  teacherId: string;
  effectiveDate: string;
  now: Date;
};
async function departureImpact(input: Departure) {
  if (input.effectiveDate < saoPauloDateOnly(input.now))
    throw badRequest("A saída não pode ser retroativa.");
  const teacher = await input.database.user.findUnique({
    where: { id: input.teacherId },
    select: { role: true, deletedAt: true, teacherProfile: { select: { departureDate: true } } },
  });
  if (!teacher || teacher.role !== "TEACHER" || teacher.deletedAt)
    throw notFound("Professor não encontrado.");
  if (teacher.teacherProfile?.departureDate)
    throw badRequest("Saída já programada para este professor.");
  const semester = await input.database.semester.findFirst({
    where: { deletedAt: null, endDate: { gte: new Date(input.effectiveDate) } },
    orderBy: { endDate: "desc" },
    select: { endDate: true },
  });
  const meetings = await meetingsBetween({
    database: input.database,
    from: input.effectiveDate,
    through: semester?.endDate.toISOString().slice(0, 10) ?? input.effectiveDate,
    now: input.now,
  });
  const commitments = meetings
    .filter(
      (row) =>
        row.editable &&
        (row.usualTeacherId === input.teacherId || row.substituteTeacherId === input.teacherId),
    )
    .map((row) => ({
      classId: row.classId,
      slotId: row.slotId,
      sessionId: row.sessionId,
      classCode: row.classCode,
      date: row.date,
      startTime: row.startTime,
      endTime: row.endTime,
    }));
  const substitutions = await input.database.classSubstitution.findMany({
    where: { revokedAt: null, date: { gte: new Date(input.effectiveDate) } },
    select: {
      id: true,
      teacherId: true,
      date: true,
      recordedAt: true,
      scheduleSlot: { select: { startTime: true } },
      classSession: { select: { startTime: true } },
      class: { select: responsibilitySelect },
    },
    orderBy: { id: "asc" },
  });
  const revocations = substitutions.filter((row) => {
    const start = row.classSession?.startTime ?? row.scheduleSlot?.startTime;
    return (
      start &&
      sessionEndInstant({ date: row.date, endTime: start }) > input.now &&
      (row.teacherId === input.teacherId ||
        usualTeacherOn(row.class, row.date)?.id === input.teacherId)
    );
  });
  const token = createHash("sha256")
    .update(
      JSON.stringify({
        commitments,
        revocations: revocations.map((row) => [row.id, row.recordedAt]),
        effectiveDate: input.effectiveDate,
      }),
    )
    .digest("hex");
  return { token, commitments, revocations };
}
export async function departurePreview(input: Departure) {
  const impact = await departureImpact(input);
  return {
    token: impact.token,
    commitments: impact.commitments,
    revokedSubstitutions: impact.revocations.length,
  };
}
export async function scheduleDeparture(
  input: Departure & { token: string; recordedById: string },
): Promise<void> {
  await lockTeacher(input.database, input.teacherId);
  const existing = await input.database.teacherProfile.findUnique({
    where: { userId: input.teacherId },
    select: { departureDate: true, departureRecordedById: true },
  });
  if (
    existing?.departureDate?.toISOString().slice(0, 10) === input.effectiveDate &&
    existing.departureRecordedById === input.recordedById
  )
    return;
  const impact = await departureImpact(input);
  if (impact.token !== input.token)
    throw badRequest("A prévia mudou. Revise os compromissos antes de confirmar.");
  await freezeStartedMeetings({
    database: input.database,
    teacherId: input.teacherId,
    effectiveDate: input.effectiveDate,
    now: input.now,
  });
  await input.database.classSubstitution.updateMany({
    where: { id: { in: impact.revocations.map((row) => row.id) }, revokedAt: null },
    data: { revokedAt: input.now, revokedById: input.recordedById },
  });
  const values = {
    departureDate: new Date(input.effectiveDate),
    departureRecordedAt: input.now,
    departureRecordedById: input.recordedById,
  };
  await input.database.teacherProfile.upsert({
    where: { userId: input.teacherId },
    create: { userId: input.teacherId, ...values },
    update: values,
  });
}
