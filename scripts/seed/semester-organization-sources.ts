import { seedStudentIndex } from "./student-fixtures.js";
import type { Prisma, Stage } from "../../packages/db/src/index.js";
import type { TransactionClient } from "../../packages/db/src/client.js";
import { DEV_STUDENTS } from "../../packages/db/src/seed-dev-data.js";
import { stableUuid } from "../../packages/db/src/seed-dev-support.js";
import { findNextStageInTrack } from "../../packages/domain/src/stage-sequence.js";
import { assessmentResults, assessmentStatus } from "../../packages/domain/src/assessment.js";
import type { OrganizationGroup } from "./semester-organization-data.js";

const TERMINAL_STAGE_STUDENT_INDEX = seedStudentIndex("school-student-76");

const sourceInclude = {
  class: { select: { id: true, scheduleType: true, semester: true } },
  progressRecords: {
    where: { deletedAt: null, endDate: null },
    include: {
      stage: {
        include: {
          track: {
            include: {
              stages: {
                where: { deletedAt: null },
                orderBy: { sequence: "asc" },
                select: { id: true, internalCode: true, sequence: true },
              },
            },
          },
        },
      },
      assessment: { include: { grades: { where: { deletedAt: null } } } },
      stagePlan: true,
    },
  },
} satisfies Prisma.EnrollmentInclude;

export type OrganizationSource = Prisma.EnrollmentGetPayload<{ include: typeof sourceInclude }>;
export type OrganizationProgress = OrganizationSource["progressRecords"][number];
export type PlacementSubject = {
  index: number;
  key: string;
  student: {
    id: string;
    fullName: string;
    status: "ACTIVE" | "SUSPENDED" | "INACTIVE" | "DROPPED";
  };
  source: OrganizationSource | null;
  progress: OrganizationProgress | null;
  stage: Stage | null;
  trackId: string;
  mode: "ENTRY" | "CONTINUE" | "ADVANCE" | "REPEAT";
};

/** Resolve historical fixture keys rather than inferring identity from a name or student number. */
export async function placementSubject(
  database: TransactionClient,
  input: { index: number; group: OrganizationGroup | null },
): Promise<PlacementSubject> {
  const { index, group } = input;
  const fixture = DEV_STUDENTS.at(index);
  if (!fixture) throw new Error("Semester organization refers to an unknown student fixture.");
  const student = await database.student.findUniqueOrThrow({
    where: { id: stableUuid(["student", fixture.key]), deletedAt: null },
    select: { id: true, fullName: true, status: true },
  });
  const membership = fixture.enrollments[0];
  const source = membership
    ? await database.enrollment.findUniqueOrThrow({
        where: {
          id: stableUuid(["enrollment", fixture.key, membership.classKey]),
          deletedAt: null,
        },
        include: sourceInclude,
      })
    : null;
  const progress = source?.progressRecords[0] ?? null;
  if (source && !sourceHasCurrentProgress(source, student.id))
    throw new Error(
      "Semester fixtures require their unchanged current source enrollment and stage.",
    );

  const stage = await targetStage(database, { group, progress, studentId: student.id });
  const trackId = proposalTrackId(stage, progress);
  const mode = proposalMode(source, { group, stage, progress });
  return { index, key: fixture.key, student, source, progress, stage, trackId, mode };
}

function sourceHasCurrentProgress(source: OrganizationSource, studentId: string): boolean {
  return source.studentId === studentId && !source.exitDate && source.progressRecords.length === 1;
}

function proposalTrackId(stage: Stage | null, progress: OrganizationProgress | null): string {
  const trackId = stage?.trackId ?? progress?.stage.trackId;
  if (!trackId) throw new Error("Every semester proposal requires an identified existing track.");
  return trackId;
}

type PublishableSubject = PlacementSubject & {
  source: OrganizationSource;
  progress: OrganizationProgress;
  stage: Stage;
};
type ConfirmedProgress = OrganizationProgress & {
  assessment: NonNullable<OrganizationProgress["assessment"]>;
};
type PublicationDates = { publishedAt: Date; startsOn: Date };
type StudentStage = { studentId: string; stageId: string };

/** A seed may leave an intention pending; it must never manufacture an approval to publish it. */
export function sourceCanPublish(subject: PlacementSubject, dates: PublicationDates): boolean {
  if (!hasSourceEvidence(subject) || !sourceWindowIsValid(subject, dates)) return false;
  const { progress, stage, student, mode } = subject;
  if (mode === "CONTINUE") return continuityEvidenceMatches(subject);
  if (!hasConfirmedDecision(progress, { studentId: student.id, publishedAt: dates.publishedAt }))
    return false;
  const evidence = progress.assessment;
  if (mode === "REPEAT") return evidence.decision === "REPEAT" && stage.id === progress.stageId;
  return advancementApproved({ progress, stage, mode, publishedAt: dates.publishedAt });
}

function hasSourceEvidence(subject: PlacementSubject): subject is PublishableSubject {
  return (
    subject.student.status === "ACTIVE" &&
    Boolean(subject.source && subject.progress && subject.stage)
  );
}

function sourceWindowIsValid(subject: PublishableSubject, dates: PublicationDates): boolean {
  const { source, progress } = subject;
  return (
    source.entryDate <= dates.publishedAt &&
    !source.exitDate &&
    progress.startDate <= dates.publishedAt &&
    source.class.semester.endDate < dates.startsOn
  );
}

function continuityEvidenceMatches(subject: PublishableSubject): boolean {
  const { source, progress, stage, student } = subject;
  if (
    source.class.scheduleType !== "PERSONALIZED" ||
    stage.id !== progress.stageId ||
    !progress.assessmentId ||
    !progress.stagePlanId
  )
    return false;
  return ongoingEvidenceMatches(progress, { studentId: student.id, stageId: stage.id });
}

function ongoingEvidenceMatches(progress: OrganizationProgress, owner: StudentStage): boolean {
  const { assessment, stagePlan } = progress;
  return Boolean(
    assessment &&
    stagePlan &&
    !assessment.deletedAt &&
    !stagePlan.deletedAt &&
    belongsToStudentStage(assessment, owner) &&
    belongsToStudentStage(stagePlan, owner),
  );
}

function belongsToStudentStage(
  record: { studentId: string | null; stageId: string },
  owner: StudentStage,
): boolean {
  return record.studentId === owner.studentId && record.stageId === owner.stageId;
}

function hasConfirmedDecision(
  progress: OrganizationProgress,
  input: { studentId: string; publishedAt: Date },
): progress is ConfirmedProgress {
  const evidence = progress.assessment;
  return Boolean(
    evidence &&
    !evidence.deletedAt &&
    evidence.studentId === input.studentId &&
    evidence.stageId === progress.stageId &&
    evidence.confirmedAt &&
    evidence.confirmedById &&
    evidence.confirmedAt <= input.publishedAt,
  );
}

function advancementApproved(input: {
  progress: ConfirmedProgress;
  stage: Stage;
  mode: PlacementSubject["mode"];
  publishedAt: Date;
}): boolean {
  const { progress, stage, mode, publishedAt } = input;
  const evidence = progress.assessment;
  const next = findNextStageInTrack({
    stages: progress.stage.track.stages,
    currentStageId: progress.stageId,
  });
  return (
    mode === "ADVANCE" &&
    next?.id === stage.id &&
    evidence.decision === "APPROVED" &&
    evidence.grades.every((grade) => grade.assessedOn <= publishedAt) &&
    assessmentStatus(
      assessmentResults(
        evidence.grades.map((grade) => ({
          competence: grade.competence,
          phase: grade.phase,
          score: grade.score.toNumber(),
        })),
      ),
    ) === "SUFFICIENT"
  );
}

async function targetStage(
  database: TransactionClient,
  input: {
    group: OrganizationGroup | null;
    progress: OrganizationProgress | null;
    studentId: string;
  },
): Promise<Stage | null> {
  const { group, progress, studentId } = input;
  if (group?.scheduleType === "REGULAR")
    return database.stage.findFirstOrThrow({
      where: { internalCode: group.stageCode!, deletedAt: null },
    });
  if (group && progress) return progress.stage;
  if (group) {
    const lead = await database.admissionCandidate.findFirst({
      where: { studentId, status: "WAITING", deletedAt: null },
      include: { stage: true },
    });
    if (!lead?.stage || lead.scheduleType !== "PERSONALIZED")
      throw new Error(
        "New PPT proposals require the existing lead's explicit placement and preference.",
      );
    return lead.stage;
  }
  return null;
}

function proposalMode(
  source: OrganizationSource | null,
  input: {
    group: OrganizationGroup | null;
    stage: Stage | null;
    progress: OrganizationProgress | null;
  },
): PlacementSubject["mode"] {
  if (!source) return "ENTRY";
  if (input.group?.scheduleType === "PERSONALIZED") return "CONTINUE";
  return input.stage?.id === input.progress?.stageId ? "REPEAT" : "ADVANCE";
}

export function proposalNotes(subject: PlacementSubject): string {
  if (subject.index === TERMINAL_STAGE_STUDENT_INDEX)
    return "C4 é o último estágio desta trilha. Conversar sobre a continuidade antes de indicar outro percurso; nenhum estágio seguinte foi presumido.";
  if (subject.student.status === "SUSPENDED")
    return "Intenção de retomada; conferir nivelamento e resolver o processo de retorno antes de publicar. Não há matrícula histórica presumida.";
  if (subject.mode === "ENTRY")
    return "Entrada futura em estudo, respeitando o estágio indicado e a preferência de curso; ainda sem matrícula publicada.";
  if (subject.mode === "REPEAT")
    return "Repetição explícita do MWY conforme decisão pedagógica; horário ainda precisa ser conciliado com o planejamento de C2.";
  if (subject.mode === "CONTINUE")
    return "Continuar o mesmo estágio no próximo semestre, preservando a avaliação e o plano individual em andamento.";
  return "Intenção de avanço para o estágio seguinte; conferir decisão pedagógica e disponibilidade antes da publicação.";
}
