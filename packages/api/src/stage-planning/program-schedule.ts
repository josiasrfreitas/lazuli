import { scheduleProgram } from "@lazuli/domain";
import { programActivityKind } from "./program-activity.js";
import { badRequest } from "../trpc/errors.js";
import { dateOnly, type PlanningContext, type PlanningScope, type Plan } from "./data.js";

const MILLISECONDS_PER_MINUTE = 60_000;
type ProgramRow = {
  programActivityId: string;
  plannedOn: Date;
  kind: "CONTENT" | "ASSESSMENT" | "REVIEW" | "ACTIVITY";
  title: string;
  reference: string;
  pageFrom: null;
  pageTo: null;
};

export async function programSchedule(
  context: PlanningContext,
  scope: PlanningScope,
  startOn: string,
  plan: Plan | null,
): Promise<ProgramRow[] | null> {
  const result = await previewProgramSchedule(context, scope, startOn, plan);
  if (!result) return null;
  if (result.missingMinutes)
    throw badRequest(
      `A programação não cabe até ${scope.semester.endOn.split("-").reverse().join("/")}: faltam ${result.missingMinutes / 60} horas de aula. Revise o início ou os horários da turma.`,
    );
  return result.rows;
}

/** A read can expose unscheduled curriculum without persisting invented dates. */
export async function previewProgramSchedule(
  context: PlanningContext,
  scope: PlanningScope,
  startOn: string,
  plan: Plan | null,
) {
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
        date: { gte: new Date(startOn), lte: new Date(scope.semester.endOn) },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
    context.database.schoolClosedDay.findMany({
      where: {
        deletedAt: null,
        date: { gte: new Date(startOn), lte: new Date(scope.semester.endOn) },
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
        date: dateOnly(session.date),
        minutes:
          (session.endTime.getTime() - session.startTime.getTime()) / MILLISECONDS_PER_MINUTE,
      })),
  );
  const rows: ProgramRow[] = result.scheduled.map(({ activity, date }) => ({
    programActivityId: activity.id,
    plannedOn: new Date(date),
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
  planId: string,
  rows: NonNullable<Awaited<ReturnType<typeof programSchedule>>>,
  plan: Plan | null,
): Promise<void> {
  for (const row of rows) {
    const existing = plan?.items.find((item) => item.programActivityId === row.programActivityId);
    if (existing)
      await context.database.stagePlanItem.update({
        where: { id: existing.id },
        data: { plannedOn: row.plannedOn },
      });
    else await context.database.stagePlanItem.create({ data: { ...row, planId } });
  }
}
