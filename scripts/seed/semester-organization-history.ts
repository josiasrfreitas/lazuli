import type { TransactionClient } from "../../packages/db/src/client.js";
import type { OrganizationContext } from "../../packages/api/src/semester-organization/data.js";
import { recordActivity } from "../../packages/api/src/activity/record.js";
import { organizationId } from "./semester-organization-data.js";
import type { PlacementSubject } from "./semester-organization-sources.js";

export async function placementRevision(
  context: OrganizationContext,
  input: {
    semesterName: string;
    placementId: string;
    action: "PROPOSED" | "REVISED" | "PUBLISHED";
    reason?: string | null;
  },
): Promise<void> {
  const { semesterName, placementId, action, reason = null } = input;
  const row = await context.database.semesterPlacement.findUniqueOrThrow({
    where: { id: placementId },
  });
  await context.database.semesterPlacementRevision.create({
    data: {
      id: organizationId("revision", {
        semesterName: semesterName,
        key: `${placementId}/${row.version}`,
      }),
      placementId,
      version: row.version,
      action,
      reason,
      recordedById: context.staffUser.id,
      createdAt: context.now,
      updatedAt: context.now,
      snapshot: {
        planId: row.planId,
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
      },
    },
  });
}

/** The source stays active today; the exit bounds its track reservation on the future entry date. */
type StudentPublication = {
  context: OrganizationContext;
  semesterName: string;
  entryDate: Date;
  subject: PlacementSubject;
  classId: string;
  availabilityId: string;
};

type VerifiedPublication = StudentPublication & {
  subject: PlacementSubject & {
    source: NonNullable<PlacementSubject["source"]>;
    progress: NonNullable<PlacementSubject["progress"]>;
    stage: NonNullable<PlacementSubject["stage"]>;
  };
};

export async function publishOrganizationStudent(input: StudentPublication): Promise<void> {
  verifyPublication(input);
  await publishVerifiedStudent(input);
}

function verifyPublication(input: StudentPublication): asserts input is VerifiedPublication {
  if (!input.subject.source || !input.subject.progress || !input.subject.stage)
    throw new Error("Published seed placements require a real source and target stage.");
}

async function publishVerifiedStudent(input: VerifiedPublication): Promise<void> {
  const { context, semesterName, subject, entryDate } = input;
  const database: TransactionClient = context.database;
  const pending = await database.enrollmentAction.count({
    where: {
      enrollmentId: subject.source.id,
      deletedAt: null,
      status: "SCHEDULED",
      kind: { in: ["PAUSE", "EXIT"] },
    },
  });
  if (pending) throw new Error("A semester seed source already has a scheduled departure.");
  const sourceExitActionId = organizationId("exit", {
    semesterName: semesterName,
    key: subject.key,
  });
  const enrollmentId = organizationId("enrollment", {
    semesterName: semesterName,
    key: subject.key,
  });
  const entryActionId = organizationId("entry", { semesterName: semesterName, key: subject.key });
  const placementId = organizationId("placement", { semesterName: semesterName, key: subject.key });
  const authored = { createdAt: context.now, updatedAt: context.now };
  // This order is required by the deferred temporal same-track constraint.
  await database.enrollmentAction.create({
    data: {
      id: sourceExitActionId,
      enrollmentId: subject.source.id,
      kind: "EXIT",
      status: "SCHEDULED",
      effectiveDate: entryDate,
      exitReason: "TRANSFERRED",
      recordedById: context.staffUser.id,
      justification: "Organização do próximo semestre",
      ...authored,
    },
  });
  await createFutureEnrollment(input, { enrollmentId, entryActionId });
  await publishPlacement(input, { placementId, enrollmentId, entryActionId, sourceExitActionId });
}

export async function recordOrganizationProposal(
  context: OrganizationContext,
  input: { semesterName: string; subject: PlacementSubject; version: number },
): Promise<void> {
  const { semesterName, subject, version } = input;
  await recordActivity(context.database, context, "semesterOrganization.savePlacement", {
    subject: { type: "student", id: subject.student.id, name: subject.student.fullName },
    description: `Proposta para ${semesterName}; ${version === 1 ? "primeira versão registrada" : "proposta revisada"}.`,
    deduplicationKey: `seed/semester-proposal/${semesterName}/${subject.key}/${version}`,
  });
}

async function createFutureEnrollment(
  input: VerifiedPublication,
  ids: { enrollmentId: string; entryActionId: string },
): Promise<void> {
  const { context, semesterName, subject, entryDate, classId } = input;
  const database = context.database;
  const { enrollmentId, entryActionId } = ids;
  const authored = { createdAt: context.now, updatedAt: context.now };
  await database.enrollment.create({
    data: {
      id: enrollmentId,
      studentId: subject.student.id,
      classId,
      entryDate,
      ...authored,
      progressRecords: {
        create: {
          id: organizationId("progress", { semesterName: semesterName, key: subject.key }),
          stageId: subject.stage.id,
          startDate: entryDate,
          assessmentId: subject.mode === "CONTINUE" ? subject.progress.assessmentId : null,
          stagePlanId: subject.mode === "CONTINUE" ? subject.progress.stagePlanId : null,
          ...authored,
        },
      },
    },
  });
  await database.enrollmentAction.create({
    data: {
      id: entryActionId,
      enrollmentId,
      sourceEnrollmentId: subject.source.id,
      kind: "ENTRY",
      status: "SCHEDULED",
      effectiveDate: entryDate,
      recordedById: context.staffUser.id,
      ...authored,
    },
  });
}

async function publishPlacement(
  input: VerifiedPublication,
  ids: {
    placementId: string;
    enrollmentId: string;
    entryActionId: string;
    sourceExitActionId: string;
  },
): Promise<void> {
  const { context, semesterName, subject, availabilityId } = input;
  const database = context.database;
  const { placementId, enrollmentId, entryActionId, sourceExitActionId } = ids;
  await database.semesterPlacement.update({
    where: { id: placementId },
    data: {
      version: { increment: 1 },
      publishedAt: context.now,
      publishedById: context.staffUser.id,
      enrollmentId,
      entryActionId,
      sourceExitActionId,
      availabilityId,
      updatedAt: context.now,
      publishedEvidence: {
        sourceProgressId: subject.progress.id,
        assessmentId: subject.progress.assessmentId,
        stagePlanId: subject.progress.stagePlanId,
        assessmentVersion: subject.progress.assessment?.version ?? null,
      },
    },
  });
  await placementRevision(context, { semesterName, placementId, action: "PUBLISHED" });
}
