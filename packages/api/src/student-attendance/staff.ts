import { randomBytes } from "node:crypto";
import { attendanceDistance, sessionEndInstant } from "@lazuli/domain";
import type { attendanceWindowOpenSchema, z } from "@lazuli/validators";
import { badRequest } from "../trpc/errors.js";
import { recordActivity } from "../activity/record.js";
import { loadRecordSession, lockClassRecord, type RecordContext } from "../class-records/data.js";
import {
  tokenHash,
  openingRestriction,
  closeAttendanceWindows,
} from "./data.js";
export async function attendanceStatus(context: RecordContext, sessionId: string) {
  const session = await loadRecordSession(context, sessionId);
  const windows = await context.database.attendanceWindow.findMany({
    where: { classSessionId: sessionId, deletedAt: null },
    orderBy: [{ openedAt: "desc" }, { id: "desc" }],
    take: 20,
    select: {
      id: true,
      openedAt: true,
      expiresAt: true,
      closedAt: true,
      openedBy: { select: { name: true } },
      closedBy: { select: { name: true } },
    },
  });
  const declarations = await context.database.attendanceDeclaration.findMany({
    where: { classSessionId: sessionId, deletedAt: null },
    orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
    include: {
      enrollment: { select: { student: { select: { fullName: true } } } },
      window: {
        select: {
          format: true,
          referenceLatitude: true,
          referenceLongitude: true,
          referenceAccuracy: true,
        },
      },
    },
  });
  return {
    sessionId,
    format: session.class.format,
    restriction: openingRestriction(session, context.now),
    windows: windows.map((row) => ({
      ...row,
      active:
        !row.closedAt &&
        row.expiresAt > context.now &&
        !session.attendanceConfirmedAt &&
        session.status !== "CANCELLED",
    })),
    declarations: declarations.map((row) => ({
      id: row.id,
      enrollmentId: row.enrollmentId,
      name: row.enrollment.student.fullName,
      submittedAt: row.submittedAt,
      matchKind: row.matchKind,
      format: row.window.format,
      accuracy: row.accuracy,
      distance:
        row.latitude !== null &&
        row.longitude !== null &&
        row.window.referenceLatitude !== null &&
        row.window.referenceLongitude !== null
          ? attendanceDistance(
              { latitude: row.latitude, longitude: row.longitude },
              { latitude: row.window.referenceLatitude, longitude: row.window.referenceLongitude },
            )
          : null,
      referenceAccuracy: row.window.referenceAccuracy,
    })),
  };
}
export async function openAttendanceWindow(
  context: RecordContext,
  input: z.infer<typeof attendanceWindowOpenSchema>,
) {
  await lockClassRecord(context.database, input.sessionId);
  const session = await loadRecordSession(context, input.sessionId);
  const restriction = openingRestriction(session, context.now);
  if (restriction) throw badRequest(restriction);
  const settings = session.class.format === "IN_PERSON" ? await context.database.attendanceSettings.findUnique({ where: { id: "school" } }) : null;
  if (session.class.format === "IN_PERSON" && !settings) throw badRequest("A administração precisa configurar a localização da escola antes de abrir o QR presencial. Você pode fazer a chamada manual.");
  if (session.class.format === "ONLINE" && input.location) throw badRequest("Aulas online não utilizam localização.");
  await closeAttendanceWindows(context.database, session.id, context.staffUser.id, context.now);
  const token = randomBytes(32).toString("base64url");
  const window = await context.database.attendanceWindow.create({
    data: {
      classSessionId: session.id,
      tokenHash: tokenHash(token),
      format: session.class.format,
      openedAt: context.now,
      expiresAt: new Date(
        Math.min(
          context.now.getTime() + (session.class.format === "IN_PERSON" ? 5 : input.minutes) * 60_000,
          sessionEndInstant(session).getTime(),
        ),
      ),
      openedById: context.staffUser.id,
      referenceLatitude: settings?.latitude ?? null,
      referenceLongitude: settings?.longitude ?? null,
      referenceAccuracy: null,
      createdAt: context.now,
      updatedAt: context.now,
    },
    select: { id: true, expiresAt: true },
  });
  await recordActivity(context.database, context, "studentAttendance.open", {
    subject: { type: "class", id: session.classId, name: session.class.portalClassName },
    description: "Abriu um novo link de presença para a aula; links anteriores foram encerrados.",
  });
  const previousProjection = await context.database.attendanceProjection.findUnique({ where: { classSessionId: session.id } });
  const projectionToken = input.projectionToken && previousProjection?.tokenHash === tokenHash(input.projectionToken) ? input.projectionToken : randomBytes(32).toString("base64url");
  const projectionData = { tokenHash: tokenHash(projectionToken), attendanceToken: token, windowExpiresAt: window.expiresAt, expiresAt: sessionEndInstant(session) };
  await context.database.attendanceProjection.upsert({ where: { classSessionId: session.id }, create: { classSessionId: session.id, ...projectionData }, update: projectionData });
  return { ...window, token, projectionToken };
}
export async function closeAttendanceWindow(context: RecordContext, sessionId: string) {
  await lockClassRecord(context.database, sessionId);
  const session = await loadRecordSession(context, sessionId);
  const current = await context.database.attendanceWindow.findFirst({
    where: { classSessionId: sessionId, closedAt: null, deletedAt: null },
  });
  if (!current) return { closed: true };
  await closeAttendanceWindows(context.database, sessionId, context.staffUser.id, context.now);
  await recordActivity(context.database, context, "studentAttendance.close", {
    subject: { type: "class", id: session.classId, name: session.class.portalClassName },
    description:
      "Encerrou o link de presença. Os envios recebidos continuam disponíveis para revisão.",
  });
  return { closed: true };
}
