import type { Prisma } from "@lazuli/db";
import { matchAttendanceNames, sessionEndInstant } from "@lazuli/domain";
import type { attendanceDeclarationSchema, z } from "@lazuli/validators";
import { badRequest } from "../trpc/errors.js";
import { lockClassRecord, dateOnly, timeOnly } from "../class-records/data.js";
import { tokenHash, declarationRoster, assertFreshLocation } from "./data.js";
type PublicContext = { database: Prisma.TransactionClient; now: Date };
async function activeWindow(context: PublicContext, token: string) {
  const window = await context.database.attendanceWindow.findUnique({
    where: { tokenHash: tokenHash(token) },
    include: {
      classSession: { include: { class: { select: { portalClassName: true, deletedAt: true } } } },
    },
  });
  if (
    !window ||
    window.deletedAt ||
    window.closedAt ||
    window.openedAt > context.now ||
    window.expiresAt <= context.now ||
    window.classSession.deletedAt ||
    window.classSession.class.deletedAt ||
    window.classSession.status === "CANCELLED" ||
    window.classSession.attendanceConfirmedAt ||
    sessionEndInstant(window.classSession) <= context.now
  )
    throw badRequest(
      "Este link está encerrado ou venceu. Peça ao professor para registrar sua presença ou abrir um novo link.",
    );
  return window;
}
export async function inspectAttendanceLink(context: PublicContext, token: string) {
  const window = await activeWindow(context, token);
  const session = window.classSession;
  return {
    className: session.class.portalClassName,
    date: dateOnly(session.date),
    startTime: timeOnly(session.startTime),
    endTime: timeOnly(session.endTime),
    format: window.format,
    expiresAt: window.expiresAt,
  };
}
export async function findAttendanceName(
  context: PublicContext,
  input: { token: string; name: string },
) {
  const window = await activeWindow(context, input.token);
  return matchAttendanceNames(
    await declarationRoster(
      context.database,
      window.classSession.classId,
      window.classSession.date,
    ),
    input.name,
  );
}
export async function submitAttendanceDeclaration(
  context: PublicContext,
  input: z.infer<typeof attendanceDeclarationSchema>,
) {
  const initial = await activeWindow(context, input.token);
  await lockClassRecord(context.database, initial.classSessionId);
  const window = await activeWindow(context, input.token);
  const matches = matchAttendanceNames(
    await declarationRoster(
      context.database,
      window.classSession.classId,
      window.classSession.date,
    ),
    input.name,
  );
  const person = matches.options.find(
    (row) => row.id === input.enrollmentId && !row.manualRequired,
  );
  if (!person)
    throw badRequest(
      "Confira o nome e selecione seu cadastro. Se houver dúvida, peça o registro manual ao professor.",
    );
  const existing = await context.database.attendanceDeclaration.findUnique({
    where: {
      classSessionId_enrollmentId: {
        classSessionId: window.classSessionId,
        enrollmentId: input.enrollmentId,
      },
    },
  });
  if (existing) return { submittedAt: existing.submittedAt, name: person.name, repeated: true };
  if (window.format === "IN_PERSON" && !input.location)
    throw badRequest(
      "Compartilhe sua localização para enviar a presença presencial. O professor também pode registrar manualmente.",
    );
  if (window.format === "ONLINE" && input.location)
    throw badRequest("Aulas online não utilizam localização.");
  if (input.location) assertFreshLocation(input.location, context.now);
  const declaration = await context.database.attendanceDeclaration.create({
    data: {
      classSessionId: window.classSessionId,
      windowId: window.id,
      enrollmentId: input.enrollmentId,
      declaredName: input.name,
      matchKind: matches.exactId === input.enrollmentId ? "EXACT" : "SELECTED",
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
  return { submittedAt: declaration.submittedAt, name: person.name, repeated: false };
}
