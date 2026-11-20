import { requireStudentAgreement, readStudentAgreements } from "../finance/index.js";
import type { Prisma } from "@lazuli/db";
import { hasFormationSignal, LOW_HEALTH_SCORE, saoPauloDateOnly } from "@lazuli/domain";
import type { FormationCaseInput } from "@lazuli/validators";
import { workspaceClasses, currentEnrollment } from "../teacher-workspace/read.js";
import { badRequest, notFound } from "../trpc/errors.js";
import {
  assertVersion,
  lockSemester,
  recordPlacementRevision,
  type OrganizationContext,
} from "./data.js";

type TeacherCase = {
  id: string;
  semesterId: string;
  semester: { name: string };
  stage: { internalCode: string } | null;
  caseEvents: { narrative: string; createdAt: Date; verbalReport: boolean | null }[];
};
export async function teacherPlacements(
  context: OrganizationContext,
  studentId: string,
): Promise<TeacherCase[]> {
  const today = new Date(saoPauloDateOnly(context.now));
  const assigned = await workspaceClasses(context);
  const classes = assigned.filter((group) => group.current);
  const enrollment = {
    ...currentEnrollment(today),
    classId: { in: classes.map((group) => group.id) },
  };
  return context.database.semesterPlacement.findMany({
    where: {
      studentId,
      student: { deletedAt: null },
      deletedAt: null,
      declinedAt: null,
      OR: [{ sourceEnrollment: enrollment }, { enrollment }],
      semester: { deletedAt: null, endDate: { gte: today } },
    },
    select: {
      id: true,
      semesterId: true,
      semester: { select: { name: true } },
      stage: { select: { internalCode: true } },
      caseEvents: {
        where: { kind: "RISK", recordedById: context.staffUser.id },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 1,
        select: { narrative: true, createdAt: true, verbalReport: true },
      },
    },
    orderBy: [{ semester: { startDate: "asc" } }, { id: "asc" }],
  });
}

type Placement = Prisma.SemesterPlacementGetPayload<Prisma.SemesterPlacementDefaultArgs>;
function reviewRisk(row: Placement, reassessment: string): Prisma.SemesterPlacementUpdateInput {
  if (!row.exitRiskActive && row.continuity !== "LEAVING")
    throw badRequest("Não há risco de saída em aberto.");
  const resolved = reassessment === "RESOLVED";
  return {
    exitRiskActive: !resolved,
    ...(resolved && row.continuity === "LEAVING"
      ? { continuity: "UNDECIDED", continuityReason: null }
      : {}),
  };
}

function assertCaseState(row: Placement, input: FormationCaseInput): void {
  if ("version" in input) assertVersion(row.version, input.version);
  if (!["BLOCK", "SCHEDULE_RISK", "RISK"].includes(input.kind) && !hasFormationSignal(row))
    throw badRequest("Registre uma sinalização antes de registrar uma intervenção.");
}

function changeRequestState(
  row: Placement,
  input: Extract<FormationCaseInput, { kind: "CHANGE_REQUEST" }>,
): Prisma.SemesterPlacementUpdateInput {
  return {
    continuity: "CHANGE",
    continuityReason: [input.outcome, input.narrative].join(" · "),
    exitRiskActive: row.exitRiskActive || row.continuity === "LEAVING",
  };
}

function stateChange(
  row: Placement,
  input: FormationCaseInput,
): Prisma.SemesterPlacementUpdateInput | null {
  assertCaseState(row, input);
  switch (input.kind) {
    case "CHANGE_REQUEST": {
      return changeRequestState(row, input);
    }
    case "RETRACT_REQUEST": {
      if (row.continuity !== "CHANGE") throw badRequest("Não há pedido de troca em aberto.");
      return { continuity: "UNDECIDED", continuityReason: null };
    }
    case "SCHEDULE_RISK":
    case "BLOCK": {
      return { attentionNote: input.narrative };
    }
    case "UNBLOCK": {
      if (!row.attentionNote) throw badRequest("Não há impedimento da equipe em aberto.");
      return { attentionNote: null };
    }
    case "RISK": {
      return { exitRiskActive: true };
    }
    case "REVIEW": {
      return reviewRisk(row, input.reassessment);
    }
    default: {
      return null;
    }
  }
}

type EventData = Pick<
  Prisma.SemesterPlacementEventUncheckedCreateInput,
  | "placementId"
  | "recordedById"
  | "kind"
  | "narrative"
  | "riskReason"
  | "verbalReport"
  | "outcome"
  | "reassessment"
  | "nextOwner"
  | "renegotiationId"
  | "renewalId"
>;

function eventReferences(
  input: FormationCaseInput,
): Pick<EventData, "renegotiationId" | "renewalId"> {
  const reference = "reference" in input ? input.reference : null;
  return {
    renegotiationId: reference?.type === "renegotiation" ? reference.id : null,
    renewalId: reference?.type === "renewal" ? reference.id : null,
  };
}

function eventData(
  input: FormationCaseInput,
  actor: Pick<EventData, "placementId" | "recordedById">,
): EventData {
  return {
    ...actor,
    kind: input.kind,
    narrative: input.narrative,
    riskReason: input.kind === "RISK" ? (input.riskReason ?? null) : null,
    verbalReport: input.kind === "RISK" ? input.verbalReport : null,
    outcome: "outcome" in input ? input.outcome : null,
    reassessment: input.kind === "REVIEW" ? input.reassessment : null,
    nextOwner: input.kind === "HANDOFF" ? input.nextOwner : null,
    ...eventReferences(input),
  };
}

function riskScore(
  context: OrganizationContext,
  studentId: string,
): Promise<{ score: number | null } | null> {
  return context.database.studentHealthPending.findFirst({
    where: { studentId, deletedAt: null, score: { lt: LOW_HEALTH_SCORE } },
    select: { score: true },
  });
}

async function alreadyRecorded(
  context: OrganizationContext,
  { id, entry }: { id: string; entry: EventData },
): Promise<boolean> {
  const previous = await context.database.semesterPlacementEvent.findUnique({
    where: { id },
  });
  if (previous) {
    if (Object.entries(entry).some(([key, value]) => previous[key as keyof typeof entry] !== value))
      throw badRequest("Este registro já foi utilizado.");
    return true;
  }
  return false;
}

async function checkTeacherAccess(
  context: OrganizationContext,
  { row, kind }: { row: Placement; kind: FormationCaseInput["kind"] },
): Promise<void> {
  if (context.staffUser.role !== "TEACHER") return;
  const allowed = await teacherPlacements(context, row.studentId);
  if (kind !== "RISK" || !allowed.some((item) => item.id === row.id))
    throw notFound("Proposta fora das suas atribuições.");
}

export async function appendCaseEvent(
  context: OrganizationContext,
  input: FormationCaseInput,
): Promise<void> {
  await lockSemester(context, input.semesterId);
  const row = await context.database.semesterPlacement.findFirst({
    where: { id: input.id, semesterId: input.semesterId, deletedAt: null, declinedAt: null },
  });
  if (!row) throw notFound("Proposta indisponível para acompanhamento.");
  await checkTeacherAccess(context, { row, kind: input.kind });
  const entry = eventData(input, { placementId: row.id, recordedById: context.staffUser.id });
  if (await alreadyRecorded(context, { id: input.eventId, entry })) return;
  const change = stateChange(row, input);
  if ("reference" in input && input.reference)
    await requireStudentAgreement(context.database, {
      studentId: row.studentId,
      reference: input.reference,
    });
  const health = input.kind === "RISK" ? await riskScore(context, row.studentId) : null;
  await context.database.semesterPlacementEvent.create({
    data: {
      ...entry,
      id: input.eventId,
      createdAt: context.now,
      healthScore: health?.score ?? null,
    },
  });
  if (change) {
    await context.database.semesterPlacement.update({
      where: { id: row.id },
      data: { ...change, version: { increment: 1 } },
    });
    await recordPlacementRevision(context, { id: row.id, action: input.kind });
  }
}

export async function caseFinanceOptions(
  context: OrganizationContext,
  id: string,
): ReturnType<typeof readStudentAgreements> {
  const row = await context.database.semesterPlacement.findFirstOrThrow({
    where: { id, deletedAt: null },
    select: { studentId: true },
  });
  return readStudentAgreements(context.database, row.studentId);
}
