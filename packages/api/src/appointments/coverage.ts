import { sessionEndInstant, teachingMinutes } from "@lazuli/domain";
import type { Prisma } from "@lazuli/db";
import type { MakeupCoverageInput } from "@lazuli/validators";
import { lockClassRecord, timeOnly } from "../class-records/data.js";
import { badRequest } from "../trpc/errors.js";
import { sourceApplicable, sourceInclude, type AppointmentContext } from "./data.js";

const coverageInclude = {
  ...sourceInclude,
  makeupCoverages: {
    where: {
      deletedAt: null,
      appointment: { deletedAt: null, status: { in: ["SCHEDULED", "ATTENDED"] } },
    },
  },
} satisfies Prisma.AttendanceInclude;
type CoverageSource = Prisma.AttendanceGetPayload<{ include: typeof coverageInclude }>;

/** Source locks serialize allocation with class-record correction. Caller holds teaching-schedule lock. */
export async function validateCoverages(
  context: AppointmentContext,
  input: {
    studentId: string;
    appointmentId: string;
    purpose: string;
    date: Date;
    startTime: Date;
    maximumMinutes: number;
    coverages: readonly MakeupCoverageInput[];
  },
): Promise<void> {
  if (input.purpose !== "MAKEUP" && input.coverages.length > 0)
    throw badRequest("Este atendimento não compensa faltas.");
  const ids = input.coverages.map((row) => row.attendanceId);
  if (new Set(ids).size !== ids.length) throw badRequest("Selecione cada falta uma única vez.");
  const sessions = await context.database.attendance.findMany({
    where: { id: { in: ids } },
    select: { classSessionId: true },
  });
  for (const sessionId of [...new Set(sessions.map((row) => row.classSessionId))].toSorted())
    await lockClassRecord(context.database, sessionId);
  const sources = await context.database.attendance.findMany({
    where: { id: { in: ids } },
    include: {
      ...coverageInclude,
      makeupCoverages: {
        ...coverageInclude.makeupCoverages,
        where: {
          ...coverageInclude.makeupCoverages.where,
          appointmentId: { not: input.appointmentId },
        },
      },
    },
  });
  const start = sessionEndInstant({ date: input.date, endTime: input.startTime });
  let total = 0;
  for (const coverage of input.coverages) {
    const source = sources.find((row) => row.id === coverage.attendanceId);
    assertCoverageSource(source, { coverage, studentId: input.studentId, start });
    total += coverage.minutes;
  }
  if (total > input.maximumMinutes)
    throw badRequest(
      `A compensação de ${total} minutos supera os ${input.maximumMinutes} minutos do atendimento.`,
    );
}

function assertCoverageSource(
  source: CoverageSource | undefined,
  { coverage, studentId, start }: { coverage: MakeupCoverageInput; studentId: string; start: Date },
): void {
  if (!source || source.enrollment.studentId !== studentId || !sourceApplicable(source))
    throw badRequest("Uma falta de origem mudou ou não pertence a este aluno. Atualize a seleção.");
  if (sessionEndInstant(source.classSession) > start)
    throw badRequest("A falta de origem deve ser anterior ao atendimento.");
  const duration = teachingMinutes({
    startTime: timeOnly(source.classSession.startTime),
    endTime: timeOnly(source.classSession.endTime),
  });
  const allocated = source.makeupCoverages.reduce((sum, row) => sum + row.minutes, 0);
  if (allocated + coverage.minutes > duration)
    throw badRequest(
      `A falta de ${source.classSession.date.toLocaleDateString("pt-BR", { timeZone: "UTC" })} tem ${Math.max(0, duration - allocated)} minutos disponíveis. Outra reposição pode ter sido registrada.`,
    );
}
