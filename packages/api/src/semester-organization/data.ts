import type { Prisma, TransactionClient } from "@lazuli/db";
import type { StaffUser } from "../trpc/context.js";
import { intervalsOverlap, saoPauloDateOnly } from "@lazuli/domain";
import { sql, type AliasedRawBuilder } from "kysely";
import { jsonObjectFrom } from "kysely/helpers/postgres";
import { classScheduleSlotInputSchema, z } from "@lazuli/validators";
import { TRPCError } from "@trpc/server";
import { badRequest, notFound } from "../trpc/errors.js";

const ISO_DATE_LENGTH = 10;
const PLAN_CLASS_ID = "plan.class_id";
const ASSIGNED_TEACHER_ID = "assignedTeacher.id";

export type OrganizationContext = { database: TransactionClient; staffUser: StaffUser; now: Date };
export const dateOnly = (value: Date | string): string =>
  typeof value === "string"
    ? value.slice(0, ISO_DATE_LENGTH)
    : value.toISOString().slice(0, ISO_DATE_LENGTH);
export const readSlots = (
  value: Prisma.JsonValue,
): {
  weekday: "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";
  startTime: string;
  endTime: string;
}[] => z.array(classScheduleSlotInputSchema).parse(value);
export async function lockSemester(
  context: OrganizationContext,
  semesterId: string,
): Promise<{
  id: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  name: string;
  startDate: Date;
  endDate: Date;
}> {
  await context.database
    .$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`semester-organization:${semesterId}`}, 0))`;
  return requireFutureSemester(context, semesterId);
}
export async function requireFutureSemester(
  context: OrganizationContext,
  semesterId: string,
): Promise<{
  id: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  name: string;
  startDate: Date;
  endDate: Date;
}> {
  const semester = await context.database.semester.findUnique({ where: { id: semesterId } });
  if (!semester) throw notFound("Semestre não encontrado.");
  if (dateOnly(semester.endDate) < saoPauloDateOnly(context.now))
    throw badRequest("Este período já terminou. Escolha um semestre atual ou futuro.");
  return semester;
}
export function assertVersion(current: number, expected: number): void {
  if (current !== expected)
    throw new TRPCError({
      code: "CONFLICT",
      message: "Esta proposta mudou. Atualize a página antes de continuar.",
    });
}
export async function recordPlacementRevision(
  context: OrganizationContext,
  options: {
    id: string;
    action: string;
    reason?: string | undefined;
  },
): Promise<void> {
  const { id, action, reason } = options;

  const row = await context.database.semesterPlacement.findUniqueOrThrow({ where: { id } });
  await context.database.semesterPlacementRevision.create({
    data: {
      placementId: id,
      version: row.version,
      action,
      reason: reason ?? null,
      recordedById: context.staffUser.id,
      createdAt: context.now,
      snapshot: {
        planId: row.planId,
        effectiveDate: row.effectiveDate ? dateOnly(row.effectiveDate) : null,
        declinedAt: row.declinedAt?.toISOString() ?? null,
        declinedReason: row.declinedReason,
        studentId: row.studentId,
        mode: row.mode,
        stageId: row.stageId,
        sourceProgressId: row.sourceProgressId,
        enrollmentId: row.enrollmentId,
        entryActionId: row.entryActionId,
        sourceExitActionId: row.sourceExitActionId,
        availabilityId: row.availabilityId,
        publishedAt: row.publishedAt?.toISOString() ?? null,
        notes: row.notes,
        continuity: row.continuity,
        continuityReason: row.continuityReason,
      },
    },
  });
}

type PlanModel = Prisma.SemesterClassPlanGetPayload<Prisma.SemesterClassPlanDefaultArgs>;
export type ClassPlan = {
  id: string;
  name: string;
  version: number;
  closedAt: Date | null;
  slots: ReturnType<typeof readSlots>;
  format: PlanModel["format"];
  scheduleType: PlanModel["scheduleType"];
  sharedStageId: string | null;
  teacherId: string | null;
  classId: string | null;
  sourceClassId: string | null;
  stageCode: string | null;
  stageName: string | null;
  teacherName: string | null;
  teacherDeletedAt: Date | null;
  departureDate: Date | null;
  classStatus: Prisma.ClassGetPayload<Prisma.ClassDefaultArgs>["status"] | null;
  classDeletedAt: Date | null;
  className: string | null;
  startDate: Date;
  endDate: Date;
  enrolledCount: number | null;
  assignedTeacher: {
    id: string;
    name: string;
    deletedAt: string | null;
    departureDate: string | null;
  } | null;
  teacherReady: boolean;
  active: boolean;
  draftConflicts: string[];
};

const PLAN_COLUMNS = [
  "plan.id",
  "plan.name",
  "plan.version",
  "plan.closed_at as closedAt",
  "plan.slots",
  "plan.format",
  "plan.schedule_type as scheduleType",
  "plan.shared_stage_id as sharedStageId",
  "plan.teacher_id as teacherId",
  "plan.class_id as classId",
  "plan.source_class_id as sourceClassId",
  "stage.internal_code as stageCode",
  "stage.name as stageName",
  "teacher.name as teacherName",
  "teacher.deleted_at as teacherDeletedAt",
  "profile.departure_date as departureDate",
  "class.status as classStatus",
  "class.deleted_at as classDeletedAt",
  "class.portal_class_name as className",
  "semester.start_date as startDate",
  "semester.end_date as endDate",
] as const;

export async function readClassPlans(
  context: OrganizationContext,
  semesterId: string,
): Promise<ClassPlan[]> {
  const rows = await context.database.$kysely
    .selectFrom("SemesterClassPlan as plan")
    .innerJoin("Semester as semester", "semester.id", "plan.semester_id")
    .leftJoin("Stage as stage", "stage.id", "plan.shared_stage_id")
    .leftJoin("Class as class", "class.id", PLAN_CLASS_ID)
    .leftJoin("User as teacher", "teacher.id", "plan.teacher_id")
    .leftJoin("TeacherProfile as profile", "profile.user_id", "plan.teacher_id")
    .select(PLAN_COLUMNS)
    .select(enrolledCount(context.now))
    .select((eb) =>
      jsonObjectFrom(
        eb
          .selectFrom("ClassTeacherAssignment as assignment")
          .innerJoin("User as assignedTeacher", ASSIGNED_TEACHER_ID, "assignment.teacher_id")
          .leftJoin(
            "TeacherProfile as assignedProfile",
            "assignedProfile.user_id",
            ASSIGNED_TEACHER_ID,
          )
          .select([
            ASSIGNED_TEACHER_ID,
            "assignedTeacher.name",
            "assignedTeacher.deleted_at as deletedAt",
            "assignedProfile.departure_date as departureDate",
          ])
          .whereRef("assignment.class_id", "=", PLAN_CLASS_ID)
          .where("assignment.deleted_at", "is", null)
          .where("assignment.superseded_at", "is", null)
          .where(
            "assignment.effective_date",
            "<=",
            sql<Date>`greatest(semester.start_date, ${saoPauloDateOnly(context.now)}::date)`,
          )
          .orderBy("assignment.effective_date", "desc")
          .limit(1),
      ).as("assignedTeacher"),
    )
    .where("plan.semester_id", "=", semesterId)
    .where("plan.deleted_at", "is", null)
    .orderBy("plan.name")
    .execute();
  const plans = rows.map((row) =>
    classPlanRow({ ...row, slots: row.slots as Prisma.JsonValue }, context.now),
  );
  return plans.map((plan) => ({ ...plan, draftConflicts: draftPlanConflicts(plan, plans) }));
}

function enrolledCount(now: Date): AliasedRawBuilder<number, "enrolledCount"> {
  const today = saoPauloDateOnly(now);
  return sql<number>`
    (
        SELECT count(DISTINCT occupied.student_id)::int
        FROM "Enrollment" AS occupied
        JOIN "Student" AS occupant ON occupant.id = occupied.student_id
        WHERE occupied.class_id = plan.class_id
          AND occupied.deleted_at IS NULL
          AND occupant.deleted_at IS NULL
          AND occupant.status = 'ACTIVE'
          AND occupied.entry_date <= greatest(semester.start_date, ${today}::date)
          AND (occupied.exit_date IS NULL OR
            occupied.exit_date > greatest(semester.start_date, ${today}::date))
      )
  `.as("enrolledCount");
}

type ClassPlanRow = Omit<ClassPlan, "slots" | "teacherReady" | "active" | "draftConflicts"> & {
  slots: Prisma.JsonValue;
};
type PlanWithoutConflicts = Omit<ClassPlan, "draftConflicts">;

function classPlanRow(row: ClassPlanRow, now: Date): PlanWithoutConflicts {
  const teacher = row.assignedTeacher;
  return {
    ...row,
    slots: readSlots(row.slots),
    teacherId: teacher?.id ?? row.teacherId,
    teacherName: teacher?.name ?? row.teacherName,
    teacherReady: planTeacherReady(row, now),
    active:
      !row.closedAt && (!row.classId || (row.classStatus === "ACTIVE" && !row.classDeletedAt)),
  };
}

function planTeacherReady(row: ClassPlanRow, now: Date): boolean {
  const teacher = row.assignedTeacher;
  const departure = teacher ? teacher.departureDate : row.departureDate;
  return Boolean(
    (teacher?.id ?? row.teacherId) &&
    !(teacher ? teacher.deletedAt : row.teacherDeletedAt) &&
    (!departure ||
      dateOnly(new Date(departure)) >
        [dateOnly(row.startDate), saoPauloDateOnly(now)].toSorted().at(-1)!),
  );
}

function draftPlanConflicts(plan: PlanWithoutConflicts, plans: PlanWithoutConflicts[]): string[] {
  const conflicts: string[] = [];
  for (const other of plans) {
    if (
      other.id === plan.id ||
      other.classId ||
      plan.classId ||
      !plan.teacherId ||
      plan.teacherId !== other.teacherId
    )
      continue;
    if (
      plan.slots.some((slot) =>
        other.slots.some(
          (candidate) => candidate.weekday === slot.weekday && intervalsOverlap(slot, candidate),
        ),
      )
    )
      conflicts.push(other.name);
  }
  return conflicts;
}
