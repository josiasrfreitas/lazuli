import type { Prisma, Stage } from "../../packages/db/src/index.js";
import type { TransactionClient } from "../../packages/db/src/client.js";
import { DEV_STUDENTS } from "../../packages/db/src/seed-dev-data.js";
import { stableUuid } from "../../packages/db/src/seed-dev-support.js";
import { findNextStageInTrack } from "../../packages/domain/src/stage-sequence.js";
import { assessmentResults, assessmentStatus } from "../../packages/domain/src/assessment.js";
import type { OrganizationGroup } from "./semester-organization-data.js";

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
  index: number,
  group: OrganizationGroup | null,
): Promise<PlacementSubject> {
  const fixture = DEV_STUDENTS[index];
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
  if (
    source &&
    (source.studentId !== student.id || source.exitDate || source.progressRecords.length !== 1)
  )
    throw new Error(
      "Semester fixtures require their unchanged current source enrollment and stage.",
    );

  let stage: Stage | null = null;
  if (group?.scheduleType === "REGULAR") {
    stage = await database.stage.findFirstOrThrow({
      where: { internalCode: group.stageCode!, deletedAt: null },
    });
  } else if (group && progress) {
    stage = progress.stage;
  } else if (group) {
    const lead = await database.admissionCandidate.findFirst({
      where: { studentId: student.id, status: "WAITING", deletedAt: null },
      include: { stage: true },
    });
    if (!lead?.stage || lead.scheduleType !== "PERSONALIZED")
      throw new Error(
        "New PPT proposals require the existing lead's explicit placement and preference.",
      );
    stage = lead.stage;
  }
  const trackId = stage?.trackId ?? progress?.stage.trackId;
  if (!trackId) throw new Error("Every semester proposal requires an identified existing track.");
  const mode = !source
    ? "ENTRY"
    : group?.scheduleType === "PERSONALIZED"
      ? "CONTINUE"
      : stage?.id === progress?.stageId
        ? "REPEAT"
        : "ADVANCE";
  return { index, key: fixture.key, student, source, progress, stage, trackId, mode };
}

/** A seed may leave an intention pending; it must never manufacture an approval to publish it. */
export function sourceCanPublish(
  subject: PlacementSubject,
  publishedAt: Date,
  startsOn: Date,
): boolean {
  const { source, progress, stage, student, mode } = subject;
  if (
    student.status !== "ACTIVE" ||
    !source ||
    !progress ||
    !stage ||
    source.entryDate > publishedAt ||
    source.exitDate ||
    progress.startDate > publishedAt ||
    source.class.semester.endDate >= startsOn
  )
    return false;
  if (mode === "CONTINUE") {
    return (
      source.class.scheduleType === "PERSONALIZED" &&
      stage.id === progress.stageId &&
      Boolean(
        progress.assessmentId &&
        progress.stagePlanId &&
        progress.assessment &&
        progress.stagePlan &&
        !progress.assessment.deletedAt &&
        !progress.stagePlan.deletedAt &&
        progress.assessment.studentId === student.id &&
        progress.assessment.stageId === stage.id &&
        progress.stagePlan.studentId === student.id &&
        progress.stagePlan.stageId === stage.id,
      )
    );
  }
  const evidence = progress.assessment;
  if (
    !evidence ||
    evidence.deletedAt ||
    evidence.studentId !== student.id ||
    evidence.stageId !== progress.stageId ||
    !evidence.confirmedAt ||
    !evidence.confirmedById ||
    evidence.confirmedAt > publishedAt
  )
    return false;
  if (mode === "REPEAT") return evidence.decision === "REPEAT" && stage.id === progress.stageId;
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

export function proposalNotes(subject: PlacementSubject): string {
  if (subject.index === 75)
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
