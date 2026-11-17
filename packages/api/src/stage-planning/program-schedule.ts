import type { Prisma } from "@lazuli/db";
import { scheduleProgram } from "@lazuli/domain";
import { programActivityKind } from "./program-activity.js";
import { badRequest } from "../trpc/errors.js";
import { dateOnly, type PlanningContext, type PlanningScope, type Plan } from "./data.js";

const MINUTES_PER_HOUR = 60;
const MILLISECONDS_PER_MINUTE = 60_000;
type ProgramRow = {
  programActivityId: string;
  plannedOn: Date;
  plannedSessionId: string | null;
  kind: "CONTENT" | "ASSESSMENT" | "REVIEW" | "ACTIVITY";
  title: string;
  reference: string;
  pageFrom: null;
  pageTo: null;
};

type ScheduleInput = { scope: PlanningScope; startOn: string; plan: Plan | null };
export type ProgramPreview = {
  rows: ProgramRow[];
  activities: Prisma.ProgramActivityGetPayload<{ include: { unit: true; teachingHour: true } }>[];
  missingMinutes: number;
};
export async function programSchedule(
  context: PlanningContext,
  { scope, startOn, plan }: ScheduleInput,
): Promise<ProgramRow[] | null> {
  const result = await previewProgramSchedule(context, { scope, startOn, plan });
  if (!result) return null;
  if (result.missingMinutes)
    throw badRequest(
      `A programação não cabe até ${scope.semester.endOn.split("-").toReversed().join("/")}: faltam ${result.missingMinutes / MINUTES_PER_HOUR} horas de aula. Revise o início ou os horários da turma.`,
    );
  return result.rows;
}

/** A read can expose unscheduled curriculum without persisting invented dates. */
export async function previewProgramSchedule(
  context: PlanningContext,
  { scope, startOn, plan }: ScheduleInput,
): Promise<ProgramPreview | null> {
  const linked = plan?.items.find((item) => item.programActivityId)?.programActivityId;
  const previous = linked
    ? await context.database.programActivity.findUnique({
        where: { id: linked },
        select: { programId: true },
      })
    : null;
  const programs = await context.database.teachingProgram.findMany({
    where: {
      stageId: scope.stage.id,
      scheduleType: scope.class.scheduleType,
      deletedAt: null,
      ...(previous ? { id: previous.programId } : { retiredAt: null }),
    },
    select: { id: true },
  });
  if (programs.length === 0) return null;
  if (programs.length > 1)
    throw badRequest(
      "Há mais de uma programação para este estágio. Defina a modalidade da turma antes de distribuir as aulas.",
    );
  const [activities, sessions, closedDays] = await Promise.all([
    context.database.programActivity.findMany({
      where: { programId: programs[0]!.id, deletedAt: null },
      orderBy: { sequence: "asc" },
      include: { unit: true, teachingHour: true },
    }),
    context.database.classSession.findMany({
      where: {
        classId: scope.class.id,
        deletedAt: null,
        status: "SCHEDULED",
        date: { gte: new Date(startOn) },
        OR: [
          { date: { lte: new Date(scope.semester.endOn) } },
          { appointmentSeriesId: { not: null } },
        ],
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
    context.database.schoolClosedDay.findMany({
      where: {
        deletedAt: null,
        date: { gte: new Date(startOn) },
      },
      select: { date: true },
    }),
  ]);
  const closed = new Set(closedDays.map((day) => dateOnly(day.date)));
  const result = scheduleProgram(
    activities,
    sessions
      .filter((session) => !closed.has(dateOnly(session.date)))
      .map((session) => ({
        id: session.id,
        date: dateOnly(session.date),
        minutes:
          (session.endTime.getTime() - session.startTime.getTime()) / MILLISECONDS_PER_MINUTE,
      })),
  );
  const rows: ProgramRow[] = result.scheduled.map(({ activity, date, sessionId }) => ({
    programActivityId: activity.id,
    plannedOn: new Date(date),
    plannedSessionId: sessionId ?? null,
    kind: programActivityKind(activity.kind),
    title: activity.title,
    reference: `Unidade ${activity.unit.sequence} · hora-aula ${activity.teachingHour.sequence}`,
    pageFrom: null,
    pageTo: null,
  }));
  return { rows, activities, missingMinutes: result.missingMinutes };
}

export async function persistProgramSchedule(
  context: PlanningContext,
  { planId, rows, plan }: { planId: string; rows: ProgramRow[]; plan: Plan | null },
): Promise<void> {
  for (const row of rows) {
    const existing = plan?.items.find((item) => item.programActivityId === row.programActivityId);
    await (existing
      ? context.database.stagePlanItem.update({
          where: { id: existing.id },
          data: { plannedOn: row.plannedOn, plannedSessionId: row.plannedSessionId },
        })
      : context.database.stagePlanItem.create({ data: { ...row, planId } }));
  }
}
