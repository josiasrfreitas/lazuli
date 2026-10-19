import { PRESENTIAL_WINDOW_MINUTES, ONLINE_WINDOW_MINUTES } from "@lazuli/validators";
import type { AttendanceStatus, OpenedWindow, SchoolLocation } from "./types.js";
import { randomBytes, randomUUID } from "node:crypto";
import { attendanceDistance, sessionEndInstant } from "@lazuli/domain";
import type { attendanceWindowOpenSchema, z } from "@lazuli/validators";
import { badRequest } from "../trpc/errors.js";
import { recordActivity } from "../activity/record.js";
import { loadRecordSession, lockClassRecord, type RecordContext } from "../class-records/data.js";
import {
  tokenHash,
  windowToken,
  openingRestriction,
  closeAttendanceWindows,
  refreshAttendanceClock,
  type AttendanceClock,
} from "./data.js";
const TOKEN_BYTES = 32;
const MINUTE_MS = 60_000;
export async function attendanceStatus(
  context: RecordContext,
  sessionId: string,
): Promise<AttendanceStatus> {
  const session = await loadRecordSession(context, sessionId);
  const windows = await readWindows(context, session);
  const declarations = await readDeclarations(context, sessionId);
  return {
    sessionId,
    format: session.class.format,
    restriction: openingRestriction(session, context.now),
    windows,
    declarations,
  };
}
async function readWindows(
  context: RecordContext,
  session: Awaited<ReturnType<typeof loadRecordSession>>,
): Promise<AttendanceStatus["windows"]> {
  const sessionId = session.id;
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
  return windows.map((row) => ({
    ...row,
    active:
      !row.closedAt &&
      row.expiresAt > context.now &&
      !session.attendanceConfirmedAt &&
      session.status !== "CANCELLED",
  }));
}
async function readDeclarations(
  context: RecordContext,
  sessionId: string,
): Promise<AttendanceStatus["declarations"]> {
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
        },
      },
    },
  });
  return declarations.map((row) => ({
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
  }));
}
export async function openAttendanceWindow(
  context: RecordContext & AttendanceClock,
  input: z.infer<typeof attendanceWindowOpenSchema>,
): Promise<OpenedWindow> {
  await lockClassRecord(context.database, input.sessionId);
  const current = refreshAttendanceClock(context);
  const session = await loadRecordSession(current, input.sessionId);
  const restriction = openingRestriction(session, current.now);
  if (restriction) throw badRequest(restriction);
  const settings =
    session.class.format === "IN_PERSON"
      ? await current.database.attendanceSettings.findUnique({ where: { key: "school" } })
      : null;
  assertOpeningSettings(session, { settings, input });
  await closeAttendanceWindows(current.database, {
    sessionId: session.id,
    userId: current.staffUser.id,
    now: current.now,
  });
  const previousProjection = await current.database.attendanceProjection.findUnique({
    where: { classSessionId: session.id },
  });
  const projectionToken =
    input.projectionToken && previousProjection?.tokenHash === tokenHash(input.projectionToken)
      ? input.projectionToken
      : randomBytes(TOKEN_BYTES).toString("base64url");
  return createWindow(current, { session, settings, projectionToken, input });
}
async function createWindow(
  context: RecordContext,
  values: {
    session: Awaited<ReturnType<typeof loadRecordSession>>;
    settings: SchoolLocation | null;
    projectionToken: string;
    input: z.infer<typeof attendanceWindowOpenSchema>;
  },
): Promise<OpenedWindow> {
  const { session, settings, projectionToken, input } = values;
  const windowId = randomUUID();
  const token = windowToken(projectionToken, windowId);
  const window = await context.database.attendanceWindow.create({
    data: {
      id: windowId,
      classSessionId: session.id,
      tokenHash: tokenHash(token),
      format: session.class.format,
      openedAt: context.now,
      expiresAt: windowExpiration({ session, now: context.now }, input.minutes),
      openedById: context.staffUser.id,
      referenceLatitude: settings?.latitude ?? null,
      referenceLongitude: settings?.longitude ?? null,
      radiusMeters: settings?.radiusMeters ?? null,
      maxAccuracyMeters: settings?.maxAccuracyMeters ?? null,
      createdAt: context.now,
      updatedAt: context.now,
    },
    select: { id: true, expiresAt: true },
  });
  await recordActivity(context.database, context, "studentAttendance.open", {
    subject: { type: "class", id: session.classId, name: session.class.portalClassName },
    description: "Abriu um novo link de presença para a aula; links anteriores foram encerrados.",
  });
  const projectionData = {
    tokenHash: tokenHash(projectionToken),
    windowId: window.id,
    expiresAt: sessionEndInstant(session),
  };
  await context.database.attendanceProjection.upsert({
    where: { classSessionId: session.id },
    create: { classSessionId: session.id, ...projectionData },
    update: projectionData,
  });
  return { ...window, token, projectionToken };
}

function windowExpiration(
  context: { session: Awaited<ReturnType<typeof loadRecordSession>>; now: Date },
  requestedMinutes: number,
): Date {
  const { session, now } = context;
  const minutes =
    session.class.format === "IN_PERSON" ? PRESENTIAL_WINDOW_MINUTES : requestedMinutes;
  return new Date(
    Math.min(now.getTime() + minutes * MINUTE_MS, sessionEndInstant(session).getTime()),
  );
}

export async function closeAttendanceWindow(
  context: RecordContext & AttendanceClock,
  sessionId: string,
): Promise<{ closed: boolean }> {
  await lockClassRecord(context.database, sessionId);
  const current = refreshAttendanceClock(context);
  const session = await loadRecordSession(current, sessionId);
  const window = await current.database.attendanceWindow.findFirst({
    where: { classSessionId: sessionId, closedAt: null, deletedAt: null },
  });
  if (!window) return { closed: true };
  await closeAttendanceWindows(current.database, {
    sessionId,
    userId: current.staffUser.id,
    now: current.now,
  });
  await recordActivity(current.database, current, "studentAttendance.close", {
    subject: { type: "class", id: session.classId, name: session.class.portalClassName },
    description:
      "Encerrou o link de presença. Os envios recebidos continuam disponíveis para revisão.",
  });
  return { closed: true };
}

function assertOpeningSettings(
  session: Awaited<ReturnType<typeof loadRecordSession>>,
  values: { settings: SchoolLocation | null; input: z.infer<typeof attendanceWindowOpenSchema> },
): void {
  const { settings, input } = values;
  if (session.class.format === "IN_PERSON" && !settings)
    throw badRequest(
      "A administração precisa configurar a localização da escola antes de abrir o QR presencial. Você pode fazer a chamada manual.",
    );
  if (session.class.format === "ONLINE" && input.location)
    throw badRequest("Aulas online não utilizam localização.");
  if (
    session.class.format === "ONLINE" &&
    !(ONLINE_WINDOW_MINUTES as readonly number[]).includes(input.minutes)
  )
    throw badRequest("Escolha uma duração disponível para o link online.");
}
