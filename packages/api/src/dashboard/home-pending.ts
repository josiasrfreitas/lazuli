import type { Prisma, TransactionClient } from "@lazuli/db";
import { saoPauloDateOnly } from "@lazuli/domain";
import { intakeEnrollmentWhere } from "../students/pending-actions.js";
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
  RENEWAL_DAYS,
  type HomeGroup,
  type HomeGroupKind,
  type HomeItem,
} from "./home-model.js";

type Database = TransactionClient;
type Scope = { kind: HomeGroupKind; now: Date; page: number; pageSize?: number; period?: "all" | "recent" | "history" };
type Page = { skip: number; take: number };
type Result = { total: number; items: HomeItem[] };
export async function readHomePending(database: Database, input: Scope): Promise<HomeGroup> {
  const take = input.pageSize ?? HOME_PAGE_SIZE;
  const page = { skip: (input.page - 1) * take, take };
  const result = await readGroup(database, { ...input, pagination: page });
  return { kind: input.kind, period: input.period ?? "all", ...HOME_GROUP_INFO[input.kind], ...result };
}
/** Recent records cover today and the preceding six school dates. */
function recordPeriod(now: Date, period: Scope["period"]): { date?: { gte: Date } | { lt: Date } } {
  const start = new Date(plusDays(saoPauloDateOnly(now), -6));
  if (period === "recent") return { date: { gte: start } };
  if (period === "history") return { date: { lt: start } };
  return {};
}
function readGroup(database: Database, input: Scope & { pagination: Page }): Promise<Result> {
  const page = input.pagination;
  switch (input.kind) {
    case "coverage": {
      return coveragePage(database, { now: input.now, page });
    }
    case "students":
    case "contracts": {
      return studentPage(database, { ...input, pagination: page });
    }
    case "allocation": {
      return allocationPage(database, page);
    }
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
  }
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
      ? { enrollments: { none: intakeEnrollmentWhere(input.now) } }
      : { contracts: { none: { deletedAt: null } } }),
  };
  const [total, rows] = await Promise.all([
    database.student.count({ where }),
    database.student.findMany({
      where,
      ...page,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true, fullName: true },
    }),
  ]);
  return {
    total,
    items: rows.map((row) =>
      linkItem({
        id: row.id,
        title: row.fullName,
        detail:
          input.kind === "students"
            ? "Conferir nivelamento e definir turma"
            : "Preparar o primeiro contrato",
        href: `/alunos/${row.id}`,
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
      select: { id: true, fullName: true, allocationPendingReason: true, allocationPendingAt: true },
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
        ...(row.allocationPendingAt && { timing: { kind: "waiting", since: row.allocationPendingAt.toISOString() } as const }),
      }),
    ),
  };
}
async function placementPage(database: Database, page: Page): Promise<Result> {
  const where: Prisma.EntryVisitWhereInput = {
    deletedAt: null,
    kind: "PLACEMENT",
    status: { in: ["SCHEDULED", "ATTENDED"] },
    assessment: { is: { stageId: null } },
    candidate: { deletedAt: null, status: "WAITING" },
  };
  const [total, rows] = await Promise.all([
    database.entryVisit.count({ where }),
    database.entryVisit.findMany({
      where,
      ...page,
      orderBy: [{ assessment: { uploadedAt: "asc" } }, { id: "asc" }],
      select: {
        id: true,
        candidateId: true,
        candidate: { select: { fullName: true } },
        assessment: { select: { uploadedAt: true } },
      },
    }),
  ]);
  return {
    total,
    items: rows.map((row) =>
      linkItem({
        id: row.id,
        title: row.candidate.fullName,
        detail: "Corrigir a prova e definir o estágio",
        href: `/interessados/${row.candidateId}`,
        date: row.assessment ? saoPauloDateOnly(row.assessment.uploadedAt) : null,
        ...(row.assessment && { timing: { kind: "waiting", since: row.assessment.uploadedAt.toISOString() } as const }),
      }),
    ),
  };
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
    ...endedWhere(now),
    ...recordPeriod(now, period),
  };
  const [total, rows] = await Promise.all([
    database.pedagogicalAppointment.count({ where }),
    database.pedagogicalAppointment.findMany({
      where,
      ...page,
      orderBy: [{ date: "asc" }, { startTime: "asc" }, { id: "asc" }],
      select: { id: true, date: true, startTime: true, endTime: true, student: { select: { fullName: true } } },
    }),
  ]);
  return {
    total,
    items: rows.map((row) => ({
      id: row.id,
      title: row.student.fullName,
      detail: `${timeOnly(row.startTime)} · Registrar o resultado do atendimento`,
      date: dateOnly(row.date),
      timing: { kind: "record", date: dateOnly(row.date), endTime: timeOnly(row.endTime) },
      action: { kind: "appointment", id: row.id },
    })),
  };
}
async function renewalPage(
  database: Database,
  { now, page }: { now: Date; page: Page },
): Promise<Result> {
  const today = saoPauloDateOnly(now);
  const where: Prisma.ContractWhereInput = {
    deletedAt: null,
    terminatedAt: null,
    commandId: { not: null },
    endsOn: { gte: new Date(today), lte: new Date(plusDays(today, RENEWAL_DAYS)) },
    student: { deletedAt: null, status: "ACTIVE" },
    renewals: { none: { deletedAt: null, terminatedAt: null } },
  };
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
        href: `/alunos/${row.studentId}?secao=financeiro`,
        date: row.endsOn ? dateOnly(row.endsOn) : null,
      }),
    ),
  };
}
