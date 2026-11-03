import { readHealthPending } from "./home-health.js";
import { readOccurrencePending } from "./home-occurrences.js";
import { studentsAwaitingPlacement } from "../students/pending-actions.js";
import { adultCutoffDateOnly } from "../students/date-rules.js";
import { pendingRenewalWhere } from "../finance/internal/renewal-pending.js";
import type { Prisma, TransactionClient } from "@lazuli/db";
import { pendingClassRecordCutoff as pendingRecordCutoff } from "../class-records/pending-policy.js";
import { saoPauloDateOnly, sessionEndInstant } from "@lazuli/domain";
import { readCoverage } from "./home-schedule.js";
import { readSemesterPending } from "./home-semester.js";
import { recordSessionInclude, responsibleTeacher, timeOnly } from "../class-records/data.js";
import {
  dateOnly,
  endedWhere,
  HOME_GROUP_INFO,
  HOME_PAGE_SIZE,
  linkItem,
  plusDays,
  type HomeGroup,
  type HomeGroupKind,
  type HomeItem,
} from "./home-model.js";

type Database = TransactionClient;
type Scope = {
  kind: HomeGroupKind;
  now: Date;
  page: number;
  pageSize?: number;
  period?: "all" | "recent" | "history";
};
type Page = { skip: number; take: number };
type Result = { total: number; items: HomeItem[] };
const RECENT_PREVIOUS_DAYS = -6;
const MILLISECONDS_PER_DAY = 86_400_000;
export async function readHomePending(database: Database, input: Scope): Promise<HomeGroup> {
  const take = input.pageSize ?? HOME_PAGE_SIZE;
  const page = { skip: (input.page - 1) * take, take };
  const result = await readGroup(database, { ...input, pagination: page });
  return {
    kind: input.kind,
    period: input.period ?? "all",
    ...HOME_GROUP_INFO[input.kind],
    ...result,
  };
}
/** Recent records cover today and the preceding six school dates. */
function recordPeriod(now: Date, period: Scope["period"]): { date?: { gte: Date } | { lt: Date } } {
  const start = new Date(plusDays(saoPauloDateOnly(now), RECENT_PREVIOUS_DAYS));
  if (period === "recent") return { date: { gte: start } };
  if (period === "history") return { date: { lt: start } };
  return {};
}
function readGroup(database: Database, input: Scope & { pagination: Page }): Promise<Result> {
  const page = input.pagination;
  switch (input.kind) {
    case "health": {
      return readHealthPending(database, { now: input.now, ...page });
    }
    case "occurrences": {
      return readOccurrencePending(database, page);
    }
    case "coverage": {
      return coveragePage(database, { now: input.now, page });
    }
    case "students":
    case "contracts": {
      return studentPage(database, { ...input, pagination: page });
    }
    case "documents": {
      return documentsPage(database, { now: input.now, page });
    }
    case "allocation": {
      return allocationPage(database, page);
    }
    default: {
      return readOtherGroup(database, input);
    }
  }
}

function readOtherGroup(database: Database, input: Scope & { pagination: Page }): Promise<Result> {
  const page = input.pagination;
  switch (input.kind) {
    case "placement": {
      return placementPage(database, page);
    }
    case "lessons": {
      return lessonPage(database, { now: input.now, page, period: input.period });
    }
    case "appointments": {
      return appointmentPage(database, { now: input.now, page, period: input.period });
    }
    case "renewals": {
      return renewalPage(database, { now: input.now, page });
    }
    case "semester": {
      return readSemesterPending(database, { now: input.now, ...page });
    }
    default: {
      throw new Error(`Grupo de pendências desconhecido: ${input.kind}`);
    }
  }
}
const REGISTRATION_KINDS = ["student", "residence", "photo"] as const;
const DOCUMENT_LABELS: Record<(typeof REGISTRATION_KINDS)[number] | "guardian", string> = {
  student: "identidade do aluno",
  guardian: "identidade do responsável",
  residence: "comprovante de residência",
  photo: "foto do aluno",
};
type RegistrationKind = keyof typeof DOCUMENT_LABELS;
async function documentsPage(
  database: Database,
  { now, page }: { now: Date; page: Page },
): Promise<Result> {
  const adultCutoff = new Date(`${adultCutoffDateOnly(now)}T00:00:00Z`);
  const where = missingDocumentsWhere(adultCutoff);
  const [total, rows] = await Promise.all([
    database.student.count({ where }),
    database.student.findMany({
      where,
      ...page,
      orderBy: [{ fullName: "asc" }, { id: "asc" }],
      select: {
        id: true,
        fullName: true,
        birthDate: true,
        documentSessions: {
          select: { files: { where: { deletedAt: null }, select: { kind: true } } },
        },
      },
    }),
  ]);
  return {
    total,
    items: rows.map((row) => {
      const present = new Set(
        row.documentSessions.flatMap((session) => session.files.map((file) => file.kind)),
      );
      const required: RegistrationKind[] = [...REGISTRATION_KINDS];
      if (row.birthDate && row.birthDate > adultCutoff) required.splice(1, 0, "guardian");
      const absent = required.filter((kind) => !present.has(kind));
      return {
        ...linkItem({
          id: row.id,
          title: row.fullName,
          detail: `Faltando: ${absent.map((kind) => DOCUMENT_LABELS[kind]).join(", ")}`,
          href: `/alunos/${row.id}?secao=cadastro`,
        }),
        missingDocuments: absent,
      };
    }),
  };
}

function missingDocumentsWhere(adultCutoff: Date): Prisma.StudentWhereInput {
  const missing = (kind: string): Prisma.StudentWhereInput => ({
    documentSessions: {
      none: { files: { some: { kind, deletedAt: null } } },
    },
  });
  return {
    deletedAt: null,
    status: "ACTIVE",
    OR: [
      ...REGISTRATION_KINDS.map((kind) => missing(kind)),
      { birthDate: { gt: adultCutoff }, ...missing("guardian") },
    ],
  };
}
async function coveragePage(
  database: Database,
  { now, page }: { now: Date; page: Page },
): Promise<Result> {
  const items = await readCoverage(database, now);
  return { total: items.length, items: items.slice(page.skip, page.skip + page.take) };
}
async function studentPage(
  database: Database,
  input: Scope & { pagination: Page },
): Promise<Result> {
  const page = input.pagination;
  const where: Prisma.StudentWhereInput = {
    deletedAt: null,
    status: "ACTIVE",
    ...(input.kind === "students"
      ? {
          id: { notIn: await studentsAwaitingPlacement(database) },
          // First allocation is independent of semester dates: past and future
          // enrollments both prove that a destination has already been defined.
          enrollments: { none: { deletedAt: null } },
          semesterPlacements: {
            none: { deletedAt: null, declinedAt: null, plan: { deletedAt: null } },
          },
        }
      : { contracts: { none: { deletedAt: null } } }),
  };
  const [total, rows] = await Promise.all([
    database.student.count({ where }),
    database.student.findMany({
      where,
      ...page,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true, fullName: true, createdAt: true },
    }),
  ]);
  return {
    total,
    items: rows.map((row) =>
      linkItem({
        id: row.id,
        title: row.fullName,
        detail:
          input.kind === "students" ? "Definir a primeira turma" : "Preparar o primeiro contrato",
        href: `/alunos/${row.id}`,
        ...(input.kind === "students" ? { date: saoPauloDateOnly(row.createdAt) } : {}),
      }),
    ),
  };
}
async function allocationPage(database: Database, page: Page): Promise<Result> {
  const where: Prisma.AdmissionCandidateWhereInput = {
    deletedAt: null,
    status: "WAITING",
    allocationPendingAt: { not: null },
  };
  const [total, rows] = await Promise.all([
    database.admissionCandidate.count({ where }),
    database.admissionCandidate.findMany({
      where,
      ...page,
      orderBy: [{ allocationPendingAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        fullName: true,
        allocationPendingReason: true,
        allocationPendingAt: true,
      },
    }),
  ]);
  return {
    total,
    items: rows.map((row) =>
      linkItem({
        id: row.id,
        title: row.fullName,
        detail: row.allocationPendingReason ?? "Buscar uma turma compatível",
        href: `/interessados/${row.id}`,
        date: row.allocationPendingAt ? saoPauloDateOnly(row.allocationPendingAt) : null,
        ...(row.allocationPendingAt && {
          timing: { kind: "waiting", since: row.allocationPendingAt.toISOString() } as const,
        }),
      }),
    ),
  };
}
async function placementPage(database: Database, page: Page): Promise<Result> {
  // One task per person, based on the latest non-cancelled placement visit.
  const candidates = await placementCandidates(database);
  const items = candidates
    .flatMap((candidate) => placementItems(candidate))
    .toSorted(
      (left, right) =>
        (left.date ?? "9999-12-31").localeCompare(right.date ?? "9999-12-31") ||
        left.id.localeCompare(right.id),
    );
  return { total: items.length, items: items.slice(page.skip, page.skip + page.take) };
}

const placementCandidateSelect = {
  id: true,
  fullName: true,
  stageId: true,
  createdAt: true,
  visits: {
    where: { kind: "PLACEMENT", deletedAt: null, status: { not: "CANCELLED" } },
    orderBy: [{ date: "desc" }, { startTime: "desc" }, { createdAt: "desc" }],
    take: 1,
    select: {
      status: true,
      date: true,
      assessment: { select: { stageId: true, uploadedAt: true } },
    },
  },
} as const satisfies Prisma.AdmissionCandidateSelect;
type PlacementCandidate = Prisma.AdmissionCandidateGetPayload<{
  select: typeof placementCandidateSelect;
}>;

function placementCandidates(database: Database): Promise<PlacementCandidate[]> {
  return database.admissionCandidate.findMany({
    where: {
      deletedAt: null,
      status: { not: "ARCHIVED" },
      OR: [
        { englishExperience: "SOME" },
        {
          visits: {
            some: {
              kind: "PLACEMENT",
              deletedAt: null,
              status: { not: "CANCELLED" },
              assessment: { is: { stageId: null } },
            },
          },
        },
      ],
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: placementCandidateSelect,
  });
}

function placementItems(candidate: PlacementCandidate): HomeItem[] {
  const visit = candidate.visits[0];
  if (completedPlacement(candidate)) return [];
  const correction = correctionVisit(visit);
  const scheduled = visit?.status === "SCHEDULED";
  const received = correction ? visit?.assessment?.uploadedAt : null;
  return [
    {
      ...linkItem({
        id: candidate.id,
        title: candidate.fullName,
        detail: placementDetail(correction, scheduled),
        href: `/interessados/${candidate.id}?nivelamento=pendente`,
        date: placementDate(received, scheduledVisitDate(visit)),
        ...placementTiming(received),
      }),
      placementPhase: correction ? ("CORRECTION" as const) : ("APPLICATION" as const),
    },
  ];
}

type PlacementVisit = PlacementCandidate["visits"][number] | undefined;
function correctionVisit(visit: PlacementVisit): boolean {
  return Boolean(visit?.assessment && visit.status !== "ABSENT");
}

function scheduledVisitDate(visit: PlacementVisit): Date | null {
  return visit?.status === "SCHEDULED" ? visit.date : null;
}

function placementTiming(received: Date | null | undefined): {
  timing?: { kind: "waiting"; since: string };
} {
  return received ? { timing: { kind: "waiting", since: received.toISOString() } } : {};
}

function completedPlacement(candidate: PlacementCandidate): boolean {
  const visit = candidate.visits[0];
  return Boolean(
    visit?.status === "ATTENDED" &&
    visit.assessment?.stageId &&
    visit.assessment.stageId === candidate.stageId,
  );
}

function placementDetail(correction: boolean, scheduled: boolean): string {
  if (correction) return "Corrigir a prova e definir o estágio";
  return scheduled ? "Aplicação agendada" : "Agendar aplicação";
}

function placementDate(received: Date | null | undefined, scheduled: Date | null): string | null {
  if (received) return saoPauloDateOnly(received);
  return scheduled ? saoPauloDateOnly(scheduled) : null;
}
async function lessonPage(
  database: Database,
  { now, page, period }: { now: Date; page: Page; period: Scope["period"] },
): Promise<Result> {
  const where: Prisma.ClassSessionWhereInput = {
    deletedAt: null,
    status: "SCHEDULED",
    classRecord: null,
    class: { deletedAt: null },
    ...endedWhere(now),
    ...recordPeriod(now, period),
  };
  const [total, rows] = await Promise.all([
    database.classSession.count({ where }),
    database.classSession.findMany({
      where,
      ...page,
      orderBy: [{ date: "asc" }, { startTime: "asc" }, { id: "asc" }],
      include: recordSessionInclude,
    }),
  ]);
  return {
    total,
    items: rows.map((row) => ({
      id: row.id,
      title: row.class.portalClassName,
      detail: `${timeOnly(row.startTime)} · ${responsibleTeacher(row)?.name ?? "Professor não atribuído"}`,
      date: dateOnly(row.date),
      timing: { kind: "record", date: dateOnly(row.date), endTime: timeOnly(row.endTime) },
      action: { kind: "lesson", id: row.id },
    })),
  };
}
async function appointmentPage(
  database: Database,
  { now, page, period }: { now: Date; page: Page; period: Scope["period"] },
): Promise<Result> {
  const where: Prisma.PedagogicalAppointmentWhereInput = {
    deletedAt: null,
    status: "SCHEDULED",
    student: { deletedAt: null },
    ...endedWhere(pendingRecordCutoff(now)),
    ...recordPeriod(now, period),
  };
  const [total, rows] = await Promise.all([
    database.pedagogicalAppointment.count({ where }),
    database.pedagogicalAppointment.findMany({
      where,
      ...page,
      orderBy: [{ date: "asc" }, { startTime: "asc" }, { id: "asc" }],
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        studentId: true,
        student: { select: { fullName: true } },
      },
    }),
  ]);
  return {
    total,
    items: rows.map((row) => ({
      ageDays: Math.floor(
        (now.getTime() - sessionEndInstant(row).getTime()) / MILLISECONDS_PER_DAY,
      ),
      id: row.id,
      title: row.student.fullName,
      detail: `${timeOnly(row.startTime)} · Registrar o resultado do atendimento`,
      date: dateOnly(row.date),
      timing: { kind: "record", date: dateOnly(row.date), endTime: timeOnly(row.endTime) },
      action: { kind: "appointment", id: row.id, studentId: row.studentId },
    })),
  };
}
async function renewalPage(
  database: Database,
  { now, page }: { now: Date; page: Page },
): Promise<Result> {
  const today = saoPauloDateOnly(now);
  const where = pendingRenewalWhere(today);
  const [total, rows] = await Promise.all([
    database.contract.count({ where }),
    database.contract.findMany({
      where,
      ...page,
      orderBy: [{ endsOn: "asc" }, { id: "asc" }],
      select: { id: true, studentId: true, endsOn: true, student: { select: { fullName: true } } },
    }),
  ]);
  return {
    total,
    items: rows.map((row) =>
      linkItem({
        id: row.id,
        title: row.student.fullName,
        detail: "Conversar sobre a continuidade do contrato",
        href: `/alunos/${row.studentId}?secao=financeiro&renovarContrato=${row.id}&voltar=%2F`,
        date: row.endsOn ? dateOnly(row.endsOn) : null,
      }),
    ),
  };
}
