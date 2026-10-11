import { sql } from "kysely";
import { jsonObjectFrom } from "kysely/helpers/postgres";
import {
  semesterPlacementBlockers,
  intervalsOverlap,
  type SemesterEligibility,
} from "@lazuli/domain";
import { z } from "@lazuli/validators";
import { dateOnly, readSlots, type OrganizationContext } from "./data.js";

export async function readClassPlans(context: OrganizationContext, semesterId: string) {
  const rows = await context.database.$kysely
    .selectFrom("SemesterClassPlan as plan")
    .innerJoin("Semester as semester", "semester.id", "plan.semester_id")
    .leftJoin("Stage as stage", "stage.id", "plan.shared_stage_id")
    .leftJoin("Class as class", "class.id", "plan.class_id")
    .leftJoin("User as teacher", "teacher.id", "plan.teacher_id")
    .leftJoin("TeacherProfile as profile", "profile.user_id", "plan.teacher_id")
    .select([
      "plan.id",
      "plan.name",
      "plan.version",
      "plan.slots",
      "plan.format",
      "plan.schedule_type as scheduleType",
      "plan.shared_stage_id as sharedStageId",
      "plan.teacher_id as teacherId",
      "plan.class_id as classId",
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
    ])
    .select((eb) =>
      jsonObjectFrom(
        eb
          .selectFrom("ClassTeacherAssignment as assignment")
          .innerJoin("User as assignedTeacher", "assignedTeacher.id", "assignment.teacher_id")
          .leftJoin(
            "TeacherProfile as assignedProfile",
            "assignedProfile.user_id",
            "assignedTeacher.id",
          )
          .select([
            "assignedTeacher.id",
            "assignedTeacher.name",
            "assignedTeacher.deleted_at as deletedAt",
            "assignedProfile.departure_date as departureDate",
          ])
          .whereRef("assignment.class_id", "=", "plan.class_id")
          .where("assignment.deleted_at", "is", null)
          .where("assignment.superseded_at", "is", null)
          .whereRef("assignment.effective_date", "<=", "semester.start_date")
          .orderBy("assignment.effective_date", "desc")
          .limit(1),
      ).as("assignedTeacher"),
    )
    .where("plan.semester_id", "=", semesterId)
    .where("plan.deleted_at", "is", null)
    .orderBy("plan.name")
    .execute();
  const plans = rows.map((row) => {
    const teacher = row.assignedTeacher;
    const departure = teacher ? teacher.departureDate : row.departureDate;
    return {
      ...row,
      slots: readSlots(row.slots),
      teacherId: teacher?.id ?? row.teacherId,
      teacherName: teacher?.name ?? row.teacherName,
      teacherReady: Boolean(
        (teacher?.id ?? row.teacherId) &&
        !(teacher ? teacher.deletedAt : row.teacherDeletedAt) &&
        (!departure || dateOnly(departure) > dateOnly(row.startDate)),
      ),
      active: !row.classId || (row.classStatus === "ACTIVE" && !row.classDeletedAt),
    };
  });
  return plans.map((plan) => ({
    ...plan,
    draftConflicts: plans
      .filter(
        (other) =>
          other.id !== plan.id &&
          !other.classId &&
          !plan.classId &&
          plan.teacherId &&
          plan.teacherId === other.teacherId &&
          plan.slots.some((slot) =>
            other.slots.some(
              (candidate) =>
                candidate.weekday === slot.weekday && intervalsOverlap(slot, candidate),
            ),
          ),
      )
      .map((other) => other.name),
  }));
}
export type ClassPlan = Awaited<ReturnType<typeof readClassPlans>>[number];

export async function readPlacementRows(context: OrganizationContext, semesterId: string) {
  return context.database.$kysely
    .selectFrom("SemesterPlacement as placement")
    .innerJoin("Student as student", "student.id", "placement.student_id")
    .leftJoin("Stage as targetStage", "targetStage.id", "placement.stage_id")
    .leftJoin("Track as targetTrack", "targetTrack.id", "targetStage.track_id")
    .leftJoin("Enrollment as source", "source.id", "placement.source_enrollment_id")
    .leftJoin("Class as sourceClass", "sourceClass.id", "source.class_id")
    .leftJoin("PedagogicalProgress as progress", "progress.id", "placement.source_progress_id")
    .leftJoin("Stage as sourceStage", "sourceStage.id", "progress.stage_id")
    .leftJoin("StageAssessment as assessment", "assessment.id", "progress.assessment_id")
    .leftJoin("EnrollmentAction as entry", "entry.id", "placement.entry_action_id")
    .leftJoin("User as publisher", "publisher.id", "placement.published_by_id")
    .select([
      "placement.id",
      "placement.version",
      "placement.student_id as studentId",
      "placement.plan_id as planId",
      "placement.stage_id as stageId",
      "placement.track_id as trackId",
      "placement.source_progress_id as sourceProgressId",
      "placement.source_enrollment_id as sourceEnrollmentId",
      "placement.mode",
      "placement.notes",
      "placement.published_at as publishedAt",
      "placement.published_evidence as publishedEvidence",
      "placement.enrollment_id as enrollmentId",
      "placement.entry_action_id as entryActionId",
      "placement.source_exit_action_id as sourceExitActionId",
      "entry.status as entryStatus",
      "publisher.name as publishedBy",
      "student.full_name as studentName",
      "student.status as studentStatus",
      "student.deleted_at as studentDeletedAt",
      "targetStage.internal_code as stageCode",
      "targetStage.sequence as targetSequence",
      "targetStage.track_id as targetTrackId",
      "targetStage.deleted_at as stageDeletedAt",
      "targetTrack.status as trackStatus",
      "source.entry_date as sourceEntryDate",
      "source.exit_date as sourceExitDate",
      "source.deleted_at as sourceDeletedAt",
      "sourceClass.schedule_type as sourceScheduleType",
      "sourceClass.portal_class_name as sourceClassName",
      "sourceClass.id as sourceClassId",
      "progress.stage_id as sourceStageId",
      "progress.end_date as progressEndDate",
      "progress.deleted_at as progressDeletedAt",
      "progress.assessment_id as assessmentId",
      "progress.stage_plan_id as stagePlanId",
      "sourceStage.track_id as sourceTrackId",
      "sourceStage.sequence as sourceSequence",
      "sourceStage.internal_code as sourceStageCode",
      "assessment.decision",
      "assessment.confirmed_at as confirmedAt",
      "assessment.deleted_at as assessmentDeletedAt",
      "assessment.version as assessmentVersion",
    ])
    .where("placement.semester_id", "=", semesterId)
    .where("placement.deleted_at", "is", null)
    .orderBy("student.full_name")
    .execute();
}
export type PlacementRow = Awaited<ReturnType<typeof readPlacementRows>>[number];
export async function currentAvailability(context: OrganizationContext, semesterId: string) {
  return context.database.$kysely
    .selectFrom("StudentAvailability as availability")
    .innerJoin("User as actor", "actor.id", "availability.recorded_by_id")
    .select([
      "availability.id",
      "availability.student_id as studentId",
      "availability.confirmed",
      "availability.valid_until as validUntil",
      "availability.formats",
      "availability.slots",
      "availability.notes",
      "availability.created_at as confirmedAt",
      "actor.name as recordedBy",
    ])
    .where("availability.semester_id", "=", semesterId)
    .where("availability.deleted_at", "is", null)
    .distinctOn("availability.student_id")
    .orderBy("availability.student_id")
    .orderBy("availability.created_at", "desc")
    .orderBy("availability.id", "desc")
    .execute();
}
export type CurrentAvailability = Awaited<ReturnType<typeof currentAvailability>>[number];
const evidenceSchema = z.object({
  assessmentId: z.string().nullable(),
  stagePlanId: z.string().nullable(),
});
export function placementEligibility(
  row: PlacementRow,
  plan: ClassPlan | null,
  availability: CurrentAvailability | null,
  entryOn: string,
): SemesterEligibility {
  return {
    entryOn,
    studentActive: row.studentStatus === "ACTIVE" && !row.studentDeletedAt,
    mode: row.mode,
    stage:
      row.stageId &&
      row.targetTrackId &&
      row.targetSequence !== null &&
      !row.stageDeletedAt &&
      row.trackStatus === "ACTIVE"
        ? { id: row.stageId, trackId: row.targetTrackId, sequence: row.targetSequence }
        : null,
    plan: plan
      ? {
          scheduleType: plan.scheduleType,
          sharedStageId: plan.sharedStageId,
          format: plan.format,
          slots: plan.slots,
          teacherReady: plan.teacherReady,
          active: plan.active,
        }
      : null,
    source:
      row.sourceProgressId &&
      row.sourceStageId &&
      row.sourceTrackId &&
      row.sourceSequence !== null &&
      row.sourceScheduleType
        ? {
            active:
              !row.sourceDeletedAt &&
              !row.progressDeletedAt &&
              !row.sourceExitDate &&
              !row.progressEndDate &&
              Boolean(row.sourceEntryDate && dateOnly(row.sourceEntryDate) < entryOn),
            stageId: row.sourceStageId,
            trackId: row.sourceTrackId,
            sequence: row.sourceSequence,
            scheduleType: row.sourceScheduleType,
            decision: row.decision,
            confirmed: Boolean(row.confirmedAt && !row.assessmentDeletedAt),
          }
        : null,
    availability: availability
      ? {
          confirmed: availability.confirmed,
          validUntil: dateOnly(availability.validUntil),
          formats: availability.formats,
          slots: readSlots(availability.slots),
        }
      : null,
  };
}
export function placementBlockers(
  row: PlacementRow,
  plan: ClassPlan | null,
  availability: CurrentAvailability | null,
  entryOn: string,
) {
  if (row.publishedAt && row.entryStatus === "APPLIED") return [];
  const blockers = semesterPlacementBlockers(
    placementEligibility(row, plan, availability, entryOn),
  );
  const evidence = evidenceSchema.safeParse(row.publishedEvidence);
  if (
    row.publishedAt &&
    row.mode === "CONTINUE" &&
    evidence.success &&
    (evidence.data.assessmentId !== row.assessmentId ||
      evidence.data.stagePlanId !== row.stagePlanId)
  )
    blockers.push("O plano ou a avaliação PPT mudou após a publicação");
  if (row.publishedAt && row.entryStatus !== "SCHEDULED")
    blockers.push("A entrada programada mudou");
  return blockers;
}
export async function readSemester(context: OrganizationContext, semesterId: string) {
  const [semester, plans, rows, availability] = await Promise.all([
    context.database.semester.findUniqueOrThrow({ where: { id: semesterId } }),
    readClassPlans(context, semesterId),
    readPlacementRows(context, semesterId),
    currentAvailability(context, semesterId),
  ]);
  const byStudent = new Map(availability.map((item) => [item.studentId, item]));
  const byPlan = new Map(plans.map((item) => [item.id, item]));
  const placements = rows.map((row) => {
    const available = byStudent.get(row.studentId) ?? null;
    return {
      ...row,
      availability: available ? { ...available, slots: readSlots(available.slots) } : null,
      blockers: placementBlockers(
        row,
        byPlan.get(row.planId ?? "") ?? null,
        available,
        dateOnly(semester.startDate),
      ),
    };
  });
  const total = await context.database.$kysely
    .selectFrom("Student")
    .select(sql<number>`count(*)::int`.as("count"))
    .where("deleted_at", "is", null)
    .executeTakeFirstOrThrow();
  return {
    semester,
    plans,
    placements,
    studentsTotal: total.count,
    studentsProposed: new Set(placements.map((item) => item.studentId)).size,
  };
}
