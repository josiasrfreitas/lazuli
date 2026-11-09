import { createServiceLogger, logDevelopmentProcess } from "@lazuli/logging";
import type { Prisma } from "@lazuli/db";
import { saoPauloDateOnly } from "@lazuli/domain";
import type { studentIntakeOptionsSchema, z } from "@lazuli/validators";
import { dateOnly } from "../admissions/candidates.js";
import { meetingsBetween } from "../teachers/schedule.js";
import { databaseSlotToCandidate } from "../teachers/availability.js";
import { responsibilitySelect, usualTeacherOn } from "../teachers/responsibility.js";
import { readSlots } from "../semester-organization/data.js";

type IntakeValues = z.infer<typeof studentIntakeOptionsSchema>;
const processLogger = createServiceLogger("web");
type IntakeClass = Prisma.ClassGetPayload<{
  include: {
    scheduleSlots: true;
    sharedStage: { select: { name: true } };
    teacher: typeof responsibilitySelect.teacher;
    teacherAssignments: typeof responsibilitySelect.teacherAssignments;
    _count: { select: { enrollments: true } };
  };
}>;
type Meeting = Awaited<ReturnType<typeof meetingsBetween>>[number];
type IntakeOptionsResult = {
  today: string;
  semester: { id: string; name: string; startDate: Date; endDate: Date } | null;
  classes: Array<{
    id: string;
    name: string;
    stageName: string;
    teacherId: string | null;
    teacherName: string;
    future: boolean;
    scheduleType: IntakeClass["scheduleType"];
    format: IntakeClass["format"];
    slots: Array<ReturnType<typeof databaseSlotToCandidate>>;
    enrolled: number;
    capacity: number;
  }>;
  meetings: Array<Pick<Meeting, "classId" | "date" | "startTime" | "endTime">>;
};

export async function studentIntakeOptions(
  database: Prisma.TransactionClient,
  options: {
    input: z.infer<typeof studentIntakeOptionsSchema>;
    now: Date;
    requestId?: string | undefined;
    userId?: string | undefined;
  },
): Promise<IntakeOptionsResult> {
  const { input, now } = options;
  const trace = (step: string, facts?: Record<string, number | boolean>): void =>
    logDevelopmentProcess(processLogger, {
      requestId: options.requestId,
      userId: options.userId,
      resource: "students.intakeOptions",
      operation: "GET",
      step,
      facts,
    });

  const today = saoPauloDateOnly(now);
  trace("Looking up the intake semester", {
    next_period: input.entryPeriod === "NEXT",
    stage_selected: Boolean(input.stageId),
  });
  const semester = await database.period.findFirst({
    where:
      input.entryPeriod === "NEXT"
        ? { deletedAt: null, startDate: { gt: new Date(today) } }
        : {
            deletedAt: null,
            startDate: { lte: new Date(today) },
            endDate: { gte: new Date(today) },
          },
    orderBy: { startDate: input.entryPeriod === "NEXT" ? "asc" : "desc" },
    select: { id: true, name: true, startDate: true, endDate: true },
  });
  trace(semester ? "Intake semester found" : "No intake semester available");
  if (input.entryPeriod === "NEXT") {
    const classes = semester
      ? await futureIntakeClasses(database, { semesterId: semester.id, input })
      : [];
    trace("Planned classes retrieved", { classes: classes.length });
    return {
      today,
      semester,
      classes,
      meetings: [],
    };
  }
  const classes = await intakeClasses(database, { semesterId: semester?.id ?? null, input, today });
  trace("Eligible classes retrieved", { classes: classes.length });
  const eligibleIds = new Set(classes.map((row) => row.id));
  const meetings = await intakeMeetings(database, { semester, input, now, today, eligibleIds });
  trace("Available sessions retrieved", { sessions: meetings.length });
  return {
    today,
    semester,
    classes: classes.map((row) => currentClassOption(row, today)),
    meetings: meetings.map((row) => ({
      classId: row.classId,
      date: row.date,
      startTime: row.startTime,
      endTime: row.endTime,
    })),
  };
}

function currentClassOption(
  row: IntakeClass,
  today: string,
): IntakeOptionsResult["classes"][number] {
  const teacher = usualTeacherOn(row, new Date(today));
  return {
    id: row.id,
    name: row.portalClassName,
    stageName: row.sharedStage?.name ?? "Estágio individual",
    teacherId: teacher?.id ?? null,
    teacherName: teacher?.name ?? "Sem professor",
    future: false,
    scheduleType: row.scheduleType,
    format: row.format,
    slots: row.scheduleSlots.map((slot) => databaseSlotToCandidate(slot)),
    enrolled: row._count.enrollments,
    capacity: row.capacity,
  };
}

async function futureIntakeClasses(
  database: Prisma.TransactionClient,
  { semesterId, input }: { semesterId: string; input: IntakeValues },
): Promise<IntakeOptionsResult["classes"]> {
  const plans = await database.semesterClassPlan.findMany({
    where: {
      semesterId,
      deletedAt: null,
      closedAt: null,
      scheduleType: input.scheduleType,
      format: input.format,
      ...(input.stageId && input.scheduleType === "REGULAR"
        ? { sharedStageId: input.stageId }
        : {}),
    },
    include: {
      sharedStage: { select: { name: true } },
      teacher: { select: { name: true } },
      sourceClass: { select: { capacity: true } },
      class: { select: { capacity: true } },
      _count: { select: { placements: { where: { deletedAt: null, declinedAt: null } } } },
    },
    orderBy: { name: "asc" },
  });
  return plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    stageName: plan.sharedStage?.name ?? "Estágio individual",
    teacherId: plan.teacherId,
    teacherName: plan.teacher?.name ?? "Sem professor",
    future: true,
    scheduleType: plan.scheduleType,
    format: plan.format,
    slots: readSlots(plan.slots),
    enrolled: plan._count.placements,
    capacity: plan.class?.capacity ?? plan.sourceClass?.capacity ?? 0,
  }));
}

async function intakeMeetings(
  database: Prisma.TransactionClient,
  {
    semester,
    input,
    now,
    today,
    eligibleIds,
  }: {
    semester: IntakeOptionsResult["semester"];
    input: IntakeValues;
    now: Date;
    today: string;
    eligibleIds: Set<string>;
  },
): Promise<Meeting[]> {
  const from = semester
    ? [input.from, dateOnly(semester.startDate), today].toSorted().at(-1)!
    : input.from;
  const through = semester
    ? [input.through, dateOnly(semester.endDate)].toSorted()[0]!
    : input.through;
  const candidates =
    eligibleIds.size > 0 && from <= through
      ? await meetingsBetween({ database, from, through, now })
      : [];
  return candidates.filter((row) => eligibleIds.has(row.classId) && !row.cancelled);
}

async function intakeClasses(
  database: Prisma.TransactionClient,
  { semesterId, input, today }: { semesterId: string | null; input: IntakeValues; today: string },
): Promise<IntakeClass[]> {
  if (!semesterId || !input.stageId) return [];
  return database.class.findMany({
    where: {
      deletedAt: null,
      status: "ACTIVE",
      semesterId,
      scheduleType: input.scheduleType,
      format: input.format,
      ...(input.scheduleType === "REGULAR" ? { sharedStageId: input.stageId } : {}),
    },
    include: {
      scheduleSlots: { where: { deletedAt: null } },
      sharedStage: { select: { name: true } },
      teacher: responsibilitySelect.teacher,
      teacherAssignments: responsibilitySelect.teacherAssignments,
      _count: {
        select: {
          enrollments: {
            where: {
              deletedAt: null,
              entryDate: { lte: new Date(today) },
              OR: [{ exitDate: null }, { exitDate: { gt: new Date(today) } }],
            },
          },
        },
      },
    },
    orderBy: { portalClassName: "asc" },
  });
}
