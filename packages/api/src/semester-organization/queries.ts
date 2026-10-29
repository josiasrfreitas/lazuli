import { responsibilitySelect, usualTeacherOn } from "../teachers/responsibility.js";
import { sql } from "kysely";
import {
  saoPauloDateOnly,
  periodConfirmation,
  type PeriodConfirmation,
  semesterPlacementBlockers,
  type SemesterEligibility,
} from "@lazuli/domain";
import { z } from "@lazuli/validators";
import type { Prisma, SchoolClosedDay, Period } from "@lazuli/db";
import {
  dateOnly,
  readSlots,
  readClassPlans,
  type ClassPlan,
  type OrganizationContext,
} from "./data.js";

const ISO_TIME_START_INDEX = 11;
const ISO_MINUTE_END_INDEX = 16;

const PLACEMENT_COLUMNS = [
  "placement.id",
  "placement.version",
  "placement.student_id as studentId",
  "placement.semester_id as semesterId",
  "placement.plan_id as planId",
  "placement.stage_id as stageId",
  "placement.track_id as trackId",
  "placement.source_progress_id as sourceProgressId",
  "placement.source_enrollment_id as sourceEnrollmentId",
  "placement.mode",
  "placement.notes",
  "placement.continuity",
  "placement.continuity_reason as continuityReason",
  "placement.effective_date as effectiveDate",
  "placement.declined_at as declinedAt",
  "placement.declined_reason as declinedReason",
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
  "sourceClass.semester_id as sourceSemesterId",
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
] as const;

type PlacementModel = Prisma.SemesterPlacementGetPayload<Prisma.SemesterPlacementDefaultArgs>;
type ClassModel = Prisma.ClassGetPayload<Prisma.ClassDefaultArgs>;
type StudentModel = Prisma.StudentGetPayload<Prisma.StudentDefaultArgs>;
type TrackModel = Prisma.TrackGetPayload<Prisma.TrackDefaultArgs>;
type AssessmentModel = Prisma.StageAssessmentGetPayload<Prisma.StageAssessmentDefaultArgs>;
type ActionModel = Prisma.EnrollmentActionGetPayload<Prisma.EnrollmentActionDefaultArgs>;
export type PlacementRow = {
  id: string;
  version: number;
  studentId: string;
  semesterId: string;
  planId: string | null;
  stageId: string | null;
  trackId: string;
  sourceProgressId: string | null;
  sourceEnrollmentId: string | null;
  mode: PlacementModel["mode"];
  notes: string | null;
  continuity: PlacementModel["continuity"];
  continuityReason: string | null;
  effectiveDate: Date | null;
  declinedAt: Date | null;
  declinedReason: string | null;
  publishedAt: Date | null;
  publishedEvidence: Prisma.JsonValue;
  enrollmentId: string | null;
  entryActionId: string | null;
  sourceExitActionId: string | null;
  entryStatus: ActionModel["status"] | null;
  publishedBy: string | null;
  studentName: string;
  studentStatus: StudentModel["status"];
  studentDeletedAt: Date | null;
  stageCode: string | null;
  targetSequence: number | null;
  targetTrackId: string | null;
  stageDeletedAt: Date | null;
  trackStatus: TrackModel["status"] | null;
  sourceEntryDate: Date | null;
  sourceExitDate: Date | null;
  sourceDeletedAt: Date | null;
  sourceScheduleType: ClassModel["scheduleType"] | null;
  sourceClassName: string | null;
  sourceClassId: string | null;
  sourceSemesterId: string | null;
  sourceStageId: string | null;
  progressEndDate: Date | null;
  progressDeletedAt: Date | null;
  assessmentId: string | null;
  stagePlanId: string | null;
  sourceTrackId: string | null;
  sourceSequence: number | null;
  sourceStageCode: string | null;
  decision: AssessmentModel["decision"] | null;
  confirmedAt: Date | null;
  assessmentDeletedAt: Date | null;
  assessmentVersion: number | null;
};

export async function readPlacementRows(
  context: OrganizationContext,
  semesterId: string,
): Promise<PlacementRow[]> {
  const rows = await context.database.$kysely
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
    .select(PLACEMENT_COLUMNS)
    .where("placement.semester_id", "=", semesterId)
    .where("placement.deleted_at", "is", null)
    .orderBy("student.full_name")
    .execute();
  return rows.map((row) => ({
    ...row,
    publishedEvidence: row.publishedEvidence as Prisma.JsonValue,
  }));
}
const evidenceSchema = z.object({
  assessmentId: z.string().nullable(),
  stagePlanId: z.string().nullable(),
});
export function placementEligibility(
  row: PlacementRow,
  options: {
    plan: ClassPlan | null;
    entryOn: string;
  },
): SemesterEligibility {
  const { plan, entryOn } = options;

  return {
    entryOn,
    semesterId: row.semesterId,
    studentActive: row.studentStatus === "ACTIVE" && !row.studentDeletedAt,
    mode: row.mode,
    stage: eligibilityStage(row),
    plan: eligibilityPlan(plan),
    source: eligibilitySource(row, entryOn),
  };
}

function eligibilityStage(row: PlacementRow): SemesterEligibility["stage"] {
  if (
    !row.stageId ||
    !row.targetTrackId ||
    row.targetSequence === null ||
    row.stageDeletedAt ||
    row.trackStatus !== "ACTIVE"
  )
    return null;
  return { id: row.stageId, trackId: row.targetTrackId, sequence: row.targetSequence };
}

function eligibilityPlan(plan: ClassPlan | null): SemesterEligibility["plan"] {
  if (!plan) return null;
  return {
    scheduleType: plan.scheduleType,
    sharedStageId: plan.sharedStageId,
    teacherReady: plan.teacherReady,
    active: plan.active,
  };
}

function eligibilitySource(row: PlacementRow, entryOn: string): SemesterEligibility["source"] {
  if (
    !row.sourceProgressId ||
    !row.sourceStageId ||
    !row.sourceTrackId ||
    row.sourceSequence === null ||
    !row.sourceScheduleType ||
    !row.sourceSemesterId
  )
    return null;
  return {
    semesterId: row.sourceSemesterId,
    active: sourceActive(row, entryOn),
    stageId: row.sourceStageId,
    trackId: row.sourceTrackId,
    sequence: row.sourceSequence,
    scheduleType: row.sourceScheduleType,
    decision: row.decision,
    confirmed: Boolean(row.confirmedAt && !row.assessmentDeletedAt),
  };
}

function sourceActive(row: PlacementRow, entryOn: string): boolean {
  return (
    !row.sourceDeletedAt &&
    !row.progressDeletedAt &&
    !row.sourceExitDate &&
    !row.progressEndDate &&
    Boolean(row.sourceEntryDate && dateOnly(row.sourceEntryDate) <= entryOn)
  );
}

export function placementBlockers(
  row: PlacementRow,
  options: {
    plan: ClassPlan | null;
    entryOn: string;
  },
): string[] {
  const { plan, entryOn } = options;

  if (placementAlreadySettled(row)) return [];
  const blockers = semesterPlacementBlockers(placementEligibility(row, { plan, entryOn }));
  if (publishedEvidenceChanged(row))
    blockers.push("O plano ou a avaliação PPT mudou após a publicação");
  if (row.publishedAt && row.entryStatus !== "SCHEDULED")
    blockers.push("A entrada programada mudou");
  return blockers;
}

function placementAlreadySettled(row: PlacementRow): boolean {
  return Boolean(
    row.declinedAt ||
    (row.publishedAt &&
      (row.entryStatus === "APPLIED" || (!row.entryActionId && row.enrollmentId))),
  );
}

function publishedEvidenceChanged(row: PlacementRow): boolean {
  const evidence = evidenceSchema.safeParse(row.publishedEvidence);
  return Boolean(
    row.publishedAt &&
    row.mode === "CONTINUE" &&
    evidence.success &&
    (evidence.data.assessmentId !== row.assessmentId ||
      evidence.data.stagePlanId !== row.stagePlanId),
  );
}
const semesterContractSelect = {
  id: true,
  studentId: true,
  startsOn: true,
  endsOn: true,
} satisfies Prisma.ContractSelect;
type SemesterContract = Prisma.ContractGetPayload<{ select: typeof semesterContractSelect }>;
const sourceClassSelect = {
  id: true,
  ...responsibilitySelect,
  scheduleSlots: {
    where: { deletedAt: null },
    select: { weekday: true, startTime: true, endTime: true },
  },
} satisfies Prisma.ClassSelect;
type SourceClass = Prisma.ClassGetPayload<{ select: typeof sourceClassSelect }>;
const waitingLeadSelect = {
  id: true,
  fullName: true,
  studentId: true,
  stageId: true,
  scheduleType: true,
  format: true,
  notes: true,
  allocationPendingReason: true,
  allocationPlanId: true,
  stage: { select: { internalCode: true } },
  allocationPlan: { select: { id: true, name: true, classId: true, semesterId: true } },
} satisfies Prisma.AdmissionCandidateSelect;
type WaitingLead = Prisma.AdmissionCandidateGetPayload<{ select: typeof waitingLeadSelect }>;
type NextSemester = Pick<Period, "id" | "name" | "startDate" | "endDate">;
type Slots = ReturnType<typeof readSlots>;
type PlacementView = PlacementRow & {
  confirmation: PeriodConfirmation;
  upcomingContract: SemesterContract | null;
  contract: SemesterContract | null;
  periodCovered: boolean;
  nextPeriodCovered: boolean;
  lastContract: SemesterContract | null;
  sourceSchedule: Slots;
  sourceTeacher: string | null;
  blockers: string[];
};
type SemesterView = {
  semester: Period;
  nextSemester: NextSemester | null;
  waitingLeads: Array<WaitingLead>;
  closedDays: SchoolClosedDay[];
  plans: ClassPlan[];
  placements: PlacementView[];
  studentsTotal: number;
  studentsProposed: number;
};

export async function readSemester(
  context: OrganizationContext,
  semesterId: string,
): Promise<SemesterView> {
  const [semester, plans, rows] = await Promise.all([
    context.database.period.findUniqueOrThrow({ where: { id: semesterId } }),
    readClassPlans(context, semesterId),
    readPlacementRows(context, semesterId),
  ]);
  const { contracts, sourceClasses, closedDays, nextSemester, waitingLeads } =
    await semesterRelations(context, { semester, rows });
  const byPlan = new Map(plans.map((item) => [item.id, item]));
  const placements = rows.map((row) =>
    placementView(context, {
      row,
      semester,
      contracts,
      nextSemester,
      sourceClass: sourceClasses.find((group) => group.id === row.sourceClassId) ?? null,
      plan: byPlan.get(row.planId ?? "") ?? null,
    }),
  );
  const total = await context.database.$kysely
    .selectFrom("Student")
    .select(sql<number>`count(*)::int`.as("count"))
    .where("deleted_at", "is", null)
    .executeTakeFirstOrThrow();
  return {
    semester,
    nextSemester,
    waitingLeads: waitingLeads,
    closedDays,
    plans,
    placements,
    studentsTotal: total.count,
    studentsProposed: new Set(placements.map((item) => item.studentId)).size,
  };
}

type PlacementViewOptions = {
  row: PlacementRow;
  semester: Period;
  contracts: SemesterContract[];
  nextSemester: NextSemester | null;
  sourceClass: SourceClass | null;
  plan: ClassPlan | null;
};

function placementView(context: OrganizationContext, options: PlacementViewOptions): PlacementView {
  const { row, semester, contracts, nextSemester, sourceClass, plan } = options;
  const coverageDate = placementCoverageDate(row, { semester, now: context.now });
  return {
    ...row,
    confirmation: periodConfirmation({
      continuity: row.continuity,
      declined: Boolean(row.declinedAt),
      enrolled: Boolean(
        row.publishedAt &&
        (row.entryStatus === "APPLIED" || (!row.entryActionId && row.enrollmentId)),
      ),
      periodStart: dateOnly(semester.startDate),
      contracts: contracts
        .filter((contract) => contract.studentId === row.studentId)
        .map((contract) => ({
          startsOn: contract.startsOn ? dateOnly(contract.startsOn) : null,
          endsOn: contract.endsOn ? dateOnly(contract.endsOn) : null,
        })),
    }),
    ...contractCoverage(contracts, { row, semester, nextSemester, coverageDate }),
    sourceSchedule: sourceSchedule(sourceClass),
    sourceTeacher: sourceClass ? (usualTeacherOn(sourceClass, context.now)?.name ?? null) : null,
    blockers: placementViewBlockers(context, { row, semester, plan }),
  };
}

function placementCoverageDate(
  row: PlacementRow,
  { semester, now }: { semester: Period; now: Date },
): string {
  const entryDate = dateOnly(row.effectiveDate ?? semester.startDate);
  return row.publishedAt && row.entryStatus !== "SCHEDULED"
    ? [saoPauloDateOnly(now), entryDate].toSorted().at(-1)!
    : entryDate;
}

type ContractCoverage = Pick<
  PlacementView,
  "upcomingContract" | "contract" | "periodCovered" | "nextPeriodCovered" | "lastContract"
>;
function contractCoverage(
  contracts: SemesterContract[],
  {
    row,
    semester,
    nextSemester,
    coverageDate,
  }: {
    row: PlacementRow;
    semester: Period;
    nextSemester: NextSemester | null;
    coverageDate: string;
  },
): ContractCoverage {
  const matching = contracts.filter((contract) => contract.studentId === row.studentId);
  const coveringContract =
    matching.find((contract) => contractCoversDate(contract, coverageDate)) ?? null;
  const upcomingContract = coveringContract
    ? null
    : (matching
        .filter((contract) => contract.startsOn && dateOnly(contract.startsOn) > coverageDate)
        .toSorted((left, right) => left.startsOn!.getTime() - right.startsOn!.getTime())[0] ??
      null);
  return {
    contract: coveringContract,
    upcomingContract,
    periodCovered: matching.some((contract) =>
      contractCoversPeriod(contract, {
        from: [dateOnly(semester.startDate), coverageDate].toSorted().at(-1)!,
        through: dateOnly(semester.endDate),
      }),
    ),
    nextPeriodCovered: Boolean(
      nextSemester &&
      matching.some((contract) =>
        contractCoversPeriod(contract, {
          from: dateOnly(nextSemester.startDate),
          through: dateOnly(nextSemester.endDate),
        }),
      ),
    ),
    lastContract: upcomingContract
      ? null
      : (matching.find(
          (contract) => contract.startsOn && dateOnly(contract.startsOn) <= coverageDate,
        ) ?? null),
  };
}

function contractCoversDate(contract: SemesterContract, date: string): boolean {
  return Boolean(
    contract.startsOn &&
    dateOnly(contract.startsOn) <= date &&
    contract.endsOn &&
    dateOnly(contract.endsOn) >= date,
  );
}

function contractCoversPeriod(
  contract: SemesterContract,
  { from, through }: { from: string; through: string },
): boolean {
  return Boolean(
    contract.startsOn &&
    contract.endsOn &&
    dateOnly(contract.startsOn) <= from &&
    dateOnly(contract.endsOn) >= through,
  );
}

function sourceSchedule(sourceClass: SourceClass | null): Slots {
  return (
    sourceClass?.scheduleSlots.map((slot) => ({
      weekday: slot.weekday,
      startTime: slot.startTime.toISOString().slice(ISO_TIME_START_INDEX, ISO_MINUTE_END_INDEX),
      endTime: slot.endTime.toISOString().slice(ISO_TIME_START_INDEX, ISO_MINUTE_END_INDEX),
    })) ?? []
  );
}

function placementViewBlockers(
  context: OrganizationContext,
  {
    row,
    semester,
    plan,
  }: {
    row: PlacementRow;
    semester: Period;
    plan: ClassPlan | null;
  },
): string[] {
  const entryOn = dateOnly(row.effectiveDate ?? semester.startDate);
  const blockers: string[] = [];
  if (row.continuity === "LEAVING" && !row.publishedAt)
    blockers.push("Conversar sobre a possível saída");
  if (!row.publishedAt && !row.declinedAt && entryOn < saoPauloDateOnly(context.now))
    blockers.push("Revise a vigência: a data proposta já passou");
  if (!row.declinedAt && outsideSemester(entryOn, semester) && !row.publishedAt)
    blockers.push("Vigência fora do período letivo");
  return [...blockers, ...placementBlockers(row, { plan, entryOn })];
}

function outsideSemester(entryOn: string, semester: Period): boolean {
  return entryOn < dateOnly(semester.startDate) || entryOn > dateOnly(semester.endDate);
}

type SemesterRelations = {
  contracts: SemesterContract[];
  sourceClasses: SourceClass[];
  closedDays: SchoolClosedDay[];
  nextSemester: NextSemester | null;
  waitingLeads: WaitingLead[];
};

async function semesterRelations(
  context: OrganizationContext,
  { semester, rows }: { semester: Period; rows: PlacementRow[] },
): Promise<SemesterRelations> {
  const [contracts, sourceClasses, closedDays, nextSemester, waitingLeads] = await Promise.all([
    context.database.contract.findMany({
      where: {
        studentId: { in: rows.map((row) => row.studentId) },
        deletedAt: null,
        terminatedAt: null,
      },
      select: semesterContractSelect,
      orderBy: { endsOn: "desc" },
    }),
    context.database.class.findMany({
      where: {
        id: {
          in: [...new Set(rows.flatMap((row) => (row.sourceClassId ? [row.sourceClassId] : [])))],
        },
      },
      select: sourceClassSelect,
    }),
    context.database.schoolClosedDay.findMany({
      where: { deletedAt: null, date: { gte: semester.startDate, lte: semester.endDate } },
      orderBy: { date: "asc" },
    }),
    context.database.period.findFirst({
      where: { deletedAt: null, startDate: { gt: semester.endDate } },
      orderBy: { startDate: "asc" },
      select: { id: true, name: true, startDate: true, endDate: true },
    }),
    context.database.admissionCandidate.findMany({
      where: {
        deletedAt: null,
        status: "WAITING",
        allocationPendingAt: { not: null },
        OR: [{ allocationPlanId: null }, { allocationPlan: { semesterId: semester.id } }],
      },
      select: waitingLeadSelect,
      orderBy: { allocationPendingAt: "asc" },
    }),
  ]);
  return { contracts, sourceClasses, closedDays, nextSemester, waitingLeads };
}
