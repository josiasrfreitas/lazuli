import type { Prisma } from "@lazuli/db";
import {
  attendanceDistance,
  matchAttendanceNames,
  sessionEndInstant,
  type AttendanceMatches,
} from "@lazuli/domain";
import type { attendanceDeclarationSchema, AttendanceLocation, z } from "@lazuli/validators";
import { badRequest } from "../trpc/errors.js";
import { lockClassRecord, dateOnly, timeOnly } from "../class-records/data.js";
import {
  tokenHash,
  declarationRoster,
  assertFreshLocation,
  refreshAttendanceClock,
  type AttendanceClock,
} from "./data.js";
import type { DeclarationReceipt, LinkInfo } from "./types.js";
type PublicContext = { database: Prisma.TransactionClient } & AttendanceClock;
type DeclarationInput = z.infer<typeof attendanceDeclarationSchema>;
const windowInclude = {
  classSession: { include: { class: { select: { portalClassName: true, deletedAt: true } } } },
} satisfies Prisma.AttendanceWindowInclude;
type Window = Prisma.AttendanceWindowGetPayload<{ include: typeof windowInclude }>;
const ENDED_LINK =
  "Este link está encerrado ou venceu. Peça ao professor para registrar sua presença ou abrir um novo link.";
async function activeWindow(context: PublicContext, token: string): Promise<Window> {
  const window = await context.database.attendanceWindow.findUnique({
    where: { tokenHash: tokenHash(token) },
    include: windowInclude,
  });
  if (!window) throw badRequest(ENDED_LINK);
  if (
    window.deletedAt ||
    window.closedAt ||
    window.openedAt > context.now ||
    window.expiresAt <= context.now
  )
    throw badRequest(ENDED_LINK);
  assertSessionOpen(window, context.now);
  return window;
}
function assertSessionOpen(window: Window, now: Date): void {
  const session = window.classSession;
  if (
    session.deletedAt ||
    session.class.deletedAt ||
    session.status === "CANCELLED" ||
    session.attendanceConfirmedAt ||
    sessionEndInstant(session) <= now
  )
    throw badRequest(ENDED_LINK);
}
export async function inspectAttendanceLink(
  context: PublicContext,
  token: string,
): Promise<LinkInfo> {
  const window = await activeWindow(context, token);
  const session = window.classSession;
  return {
    className: session.class.portalClassName,
    date: dateOnly(session.date),
    startTime: timeOnly(session.startTime),
    endTime: timeOnly(session.endTime),
    format: window.format,
    expiresAt: window.expiresAt,
    sessionId: session.id,
  };
}
export async function findAttendanceName(
  context: PublicContext,
  input: { token: string; name: string },
): Promise<AttendanceMatches> {
  const window = await activeWindow(context, input.token);
  const roster = await declarationRoster(context.database, {
    classId: window.classSession.classId,
    date: window.classSession.date,
  });
  return matchAttendanceNames(roster, input.name);
}
export async function submitAttendanceDeclaration(
  context: PublicContext,
  input: DeclarationInput,
): Promise<DeclarationReceipt> {
  const initial = await activeWindow(context, input.token);
  await lockClassRecord(context.database, initial.classSessionId);
  const current = refreshAttendanceClock(context);
  const window = await activeWindow(current, input.token);
  const browserHash = tokenHash(`${window.classSessionId}:${input.browserId}`);
  const repeated = await previousDeclaration(current, { window, input, browserHash });
  if (repeated) return repeated;
  const matches = await findAttendanceName(current, input);
  const person = matches.options.find(
    (row) => row.id === input.enrollmentId && !row.manualRequired,
  );
  if (!person)
    throw badRequest(
      "Confira o nome e selecione seu cadastro. Se houver dúvida, peça o registro manual ao professor.",
    );
  assertDeclarationLocation(window, { location: input.location, now: current.now });
  const declaration = await createDeclaration(current, {
    window,
    input,
    browserHash,
    exact: matches.exactId === person.id,
  });
  return { submittedAt: declaration.submittedAt, name: person.name, repeated: false };
}
async function previousDeclaration(
  context: PublicContext,
  values: { window: Window; input: DeclarationInput; browserHash: string },
): Promise<DeclarationReceipt | null> {
  const { window, input, browserHash } = values;
  const used = await context.database.attendanceDeclaration.findUnique({
    where: { classSessionId_browserHash: { classSessionId: window.classSessionId, browserHash } },
    include: { enrollment: { select: { student: { select: { fullName: true } } } } },
  });
  if (used) {
    if (used.enrollmentId !== input.enrollmentId)
      throw badRequest(
        "Este navegador já confirmou uma pessoa nesta aula. Peça ao professor para registrar sua presença manualmente.",
      );
    return {
      submittedAt: used.submittedAt,
      name: used.enrollment.student.fullName,
      repeated: true,
    };
  }
  const existing = await context.database.attendanceDeclaration.findUnique({
    where: {
      classSessionId_enrollmentId: {
        classSessionId: window.classSessionId,
        enrollmentId: input.enrollmentId,
      },
    },
  });
  if (existing)
    throw badRequest(
      "Este nome já enviou uma declaração nesta aula. Confira com o professor. A tentativa não consumiu a confirmação deste navegador.",
    );
  return null;
}
function assertDeclarationLocation(
  window: Window,
  input: { location: AttendanceLocation | null; now: Date },
): void {
  const { location, now } = input;
  if (window.format === "IN_PERSON" && !location)
    throw badRequest(
      "Compartilhe sua localização para enviar a presença presencial. O professor também pode registrar manualmente.",
    );
  if (window.format === "ONLINE" && location)
    throw badRequest("Aulas online não utilizam localização.");
  if (!location) return;
  assertFreshLocation(location, now);
  assertCampusLocation(window, location);
}
function assertCampusLocation(window: Window, location: AttendanceLocation): void {
  const {
    referenceLatitude: latitude,
    referenceLongitude: longitude,
    radiusMeters,
    maxAccuracyMeters,
  } = window;
  if (
    latitude === null ||
    longitude === null ||
    radiusMeters === null ||
    maxAccuracyMeters === null
  )
    throw badRequest("A localização da escola ainda não foi configurada. Peça a chamada manual.");
  if (location.accuracy > maxAccuracyMeters)
    throw badRequest(
      "Sua localização não tem precisão suficiente. Tente novamente ou peça a chamada manual.",
    );
  if (attendanceDistance(location, { latitude, longitude }) > radiusMeters)
    throw badRequest(
      "Sua localização está fora da área da escola. Peça ao professor a chamada manual.",
    );
}
async function createDeclaration(
  context: PublicContext,
  values: { window: Window; input: DeclarationInput; browserHash: string; exact: boolean },
): Promise<{ submittedAt: Date }> {
  const { window, input, browserHash, exact } = values;
  return context.database.attendanceDeclaration.create({
    data: {
      classSessionId: window.classSessionId,
      windowId: window.id,
      enrollmentId: input.enrollmentId,
      declaredName: input.name,
      matchKind: exact ? "EXACT" : "SELECTED",
      browserHash,
      submittedAt: context.now,
      latitude: input.location?.latitude ?? null,
      longitude: input.location?.longitude ?? null,
      accuracy: input.location?.accuracy ?? null,
      capturedAt: input.location ? new Date(input.location.capturedAt) : null,
      createdAt: context.now,
      updatedAt: context.now,
    },
    select: { submittedAt: true },
  });
}
