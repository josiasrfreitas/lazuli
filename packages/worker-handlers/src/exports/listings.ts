import {
  listStudents,
  listClasses,
  listTeachers,
  teacherListScores,
  listCandidates,
  finance,
  catalogDirectory,
} from "@lazuli/api/listing-reads";
import { readStudentHealthBatch, type TransactionClient } from "@lazuli/db";
import { classOccupancyLevel, saoPauloDateOnly } from "@lazuli/domain";
import type { TableExportRequest } from "@lazuli/validators";
import { money, percent, type ExportTable, type ExportValue, type Tone } from "./workbook.js";

async function pages(
  headings: string[],
  read: (page: number) => Promise<{ rows: ExportValue[][]; pageCount: number }>,
): Promise<ExportTable> {
  const first = await read(1);
  for (let page = 2; page <= first.pageCount; page++) {
    const next = await read(page);
    for (const row of next.rows) first.rows.push(row);
  }
  return { headings, rows: first.rows };
}
const text = (value: string | number, tone: Tone): ExportValue => ({ value, tone });
const date = (iso: string): string => iso.split("-").toReversed().join("/");
const weekdays: Record<string, string> = {
  MONDAY: "Seg",
  TUESDAY: "Ter",
  WEDNESDAY: "Qua",
  THURSDAY: "Qui",
  FRIDAY: "Sex",
  SATURDAY: "Sáb",
  SUNDAY: "Dom",
};
const origin = {
  TUITION: "Mensalidade",
  ENROLLMENT_FEE: "Taxa de matrícula",
  MATERIAL: "Material",
  OTHER: "Outro",
};
type Source = TableExportRequest["source"];
type Filters<Listing extends Source["listing"]> = Extract<Source, { listing: Listing }>["filters"];
type ExportOptions = { source: Source; actor: string; now: Date };
type ExportContext = Omit<ExportOptions, "source"> & { db: TransactionClient; today: string };

const ISO_TIME_START = 11;
const ISO_TIME_END = 16;
const ISO_DATE_LENGTH = 10;
const ISO_MONTH_LENGTH = 7;
const MINUTES_PER_HOUR = 60;
const PERCENT_TOTAL = 100;

export function readExport(
  db: TransactionClient,
  { source, actor, now }: ExportOptions,
): Promise<ExportTable> {
  const context = { db, now, actor, today: saoPauloDateOnly(now) };
  switch (source.listing) {
    case "Alunos": {
      return studentExport(context, source.filters);
    }
    case "Turmas": {
      return classExport(context, source.filters);
    }
    case "Leads": {
      return leadExport(context, source.filters);
    }
    case "Contratos": {
      return contractExport(context, source.filters);
    }
    case "Recebíveis": {
      return installmentExport(context, source.filters);
    }
    case "Fluxo de caixa": {
      return cashExport(context, source.filters);
    }
    case "Contratos fechados": {
      return closingsExport(context, source.filters);
    }
    case "Estágios": {
      return catalogExport(context, source.filters);
    }
    default: {
      return teacherExport(context, source.filters);
    }
  }
}

function studentExport(
  { db, now, actor }: ExportContext,
  filters: Filters<"Alunos">,
): Promise<ExportTable> {
  return pages(
    [
      "Aluno",
      "Situação",
      "Bolsa",
      "Turma",
      "Horário",
      "Docente",
      "Score",
      "Frequência",
      "Financeiro",
    ],
    async (page) => {
      const result = await listStudents({
        database: db,
        values: { ...filters, page, pageSize: 50, now, staffUserId: actor },
      });
      const health = await readStudentHealthBatch({
        database: db,
        ids: result.rows.map((row) => row.id),
        now,
      });
      const scores = new Map(health.map((row) => [row.studentId, row]));
      return {
        ...result,
        rows: result.rows.map((row) => {
          const score = scores.get(row.id);
          return [
            row.fullName,
            {
              ACTIVE: "Ativo",
              SUSPENDED: "Trancado",
              DROPPED: "Desistente",
              INACTIVE: "Inativo",
            }[row.status],
            row.isScholarshipStudent ? "Bolsista" : "Sem bolsa",
            row.enrollment?.classCode ?? "",
            row.enrollment?.scheduleLabel ?? "",
            row.enrollment?.teacherName ?? "",
            studentScore(score),
            studentAttendance(row.attendance),
            studentFinance(row.finance),
          ];
        }),
      };
    },
  );
}

function classExport({ db, now }: ExportContext, filters: Filters<"Turmas">): Promise<ExportTable> {
  return pages(
    ["Turma", "Modalidade", "Formato", "Docente", "Estágio", "Horários", "Ocupação", "Capacidade"],
    async (page) => {
      const result = await listClasses({
        database: db,
        values: { ...filters, page },
        now,
      });
      return {
        ...result,
        rows: result.rows.map((row) => [
          row.portalClassName,
          row.scheduleType === "REGULAR" ? "Regular" : "PPT",
          row.format === "ONLINE" ? "Online" : "Presencial",
          row.currentTeacher?.name ?? "Sem docente",
          row.sharedStage?.name ?? "Individual",
          row.scheduleSlots
            .map(
              (slot) =>
                weekdays[slot.weekday] +
                " " +
                slot.startTime.toISOString().slice(ISO_TIME_START, ISO_TIME_END) +
                "–" +
                slot.endTime.toISOString().slice(ISO_TIME_START, ISO_TIME_END),
            )
            .join(", "),
          text(
            row.occupancy,
            ({ normal: "success", high: "warning", over: "danger" } as const)[
              classOccupancyLevel(row.occupancy, row.capacity)
            ],
          ),
          row.capacity,
        ]),
      };
    },
  );
}

function teacherExport(
  { db, now, today }: ExportContext,
  filters: Filters<"Docentes" | "Professores">,
): Promise<ExportTable> {
  return pages(
    [
      "Docente",
      "E-mail",
      "Turmas",
      "Score médio",
      "Horas realizadas",
      "Horas planejadas",
      "Atendimento realizado (h)",
      "Atendimento planejado (h)",
      "Atuação",
      "Acesso",
    ],
    async (page) => {
      const result = await listTeachers({
        database: db,
        input: { ...filters, page },
        now,
      });
      const scores = await teacherListScores(db, {
        ids: result.rows.map((row) => row.id),
        now,
      });
      return {
        ...result,
        rows: result.rows.map((row) => {
          const departure = row.teacherProfile?.departureDate
            ?.toISOString()
            .slice(0, ISO_DATE_LENGTH);
          const departed = Boolean(departure && departure <= today);
          return [
            row.name,
            row.email,
            row.classCount,
            scores[row.id] ?? "Sem dados",
            row.monthlyHours.completedMinutes / MINUTES_PER_HOUR,
            row.monthlyHours.plannedMinutes / MINUTES_PER_HOUR,
            row.appointmentHours.completedMinutes / MINUTES_PER_HOUR,
            row.appointmentHours.plannedMinutes / MINUTES_PER_HOUR,
            teacherActivity(departure, departed),
            row.isEnabled && (!departed || row.role === "ADMIN" || row.role === "SYSTEM_ADMIN")
              ? "Habilitado"
              : "Não habilitado",
          ];
        }),
      };
    },
  );
}

function leadExport({ db, now }: ExportContext, filters: Filters<"Leads">): Promise<ExportTable> {
  return pages(
    ["Lead", "Telefone", "E-mail", "Interesse", "Estágio", "Formato", "Status", "Cadastro"],
    async (page) => {
      const result = await listCandidates(db, { input: { ...filters, page }, now });
      return {
        ...result,
        rows: result.rows.map((row) => [
          row.fullName,
          row.phone ?? "",
          row.email ?? "",
          { UNKNOWN: "Não informado", LOW: "Baixo", MEDIUM: "Médio", HIGH: "Alto" }[row.interest],
          row.stage?.name ??
            (row.englishExperience === "SOME" ? "Nivelamento pendente" : "A definir"),
          leadFormat(row.format),
          leadStatus(row.status),
          date(row.createdAt.toISOString().slice(0, ISO_DATE_LENGTH)),
        ]),
      };
    },
  );
}

function contractExport(
  { db, now, actor }: ExportContext,
  filters: Filters<"Contratos">,
): Promise<ExportTable> {
  return pages(
    [
      "Aluno",
      "Pagador",
      "Início",
      "Término",
      "Parcelas",
      "Parcelas pagas",
      "Bolsa",
      "Situação financeira",
      "Renovação pendente",
      "Material pendente",
    ],
    async (page) => {
      const row = await finance(db, actor).listContracts({ ...filters, page, now });
      return {
        pageCount: Math.ceil(row.total / row.pageSize),
        rows: row.rows.map((contract) => [
          contract.student.fullName,
          contract.payer.name,
          date(contract.startsOn),
          date(contract.endsOn),
          contract.installmentCount,
          contract.paymentProgress.paid,
          percent(contract.scholarshipPct / PERCENT_TOTAL),
          {
            EM_DIA: text("Em dia", "success"),
            QUITADO: text("Quitado", "success"),
            INADIMPLENTE: text("Inadimplente", "danger"),
            SEM_SALDO: text("Sem saldo a cobrar", "muted"),
            CANCELADO: text("Cancelado", "muted"),
          }[contract.status],
          contract.renewalPending ? text("Sim", "warning") : "Não",
          contract.materialDue ?? "",
        ]),
      };
    },
  );
}

function installmentExport(
  { db, now, actor, today }: ExportContext,
  filters: Filters<"Recebíveis">,
): Promise<ExportTable> {
  return pages(
    [
      "Pagador",
      "Beneficiários",
      "Origem",
      "Parcela",
      "Vencimento",
      "Valor previsto",
      "Valor pago",
      "Saldo",
      "Situação",
    ],
    async (page) => {
      const result = await finance(db, actor).installments({ ...filters, page }, now);
      const rows = "groups" in result ? result.groups.flatMap((group) => group.rows) : result.rows;
      return {
        ...result,
        rows: rows.map((row) => [
          row.payer.name,
          row.beneficiaries.map((beneficiary) => beneficiary.fullName).join(", "),
          origin[row.origin],
          row.sequenceNumber,
          date(row.dueDate),
          money(row.expectedAmountCents),
          money(row.paidAmountCents),
          money(row.collectibleBalanceCents),
          installmentStatus(row, today),
        ]),
      };
    },
  );
}

async function cashExport(
  { db, now, actor }: ExportContext,
  filters: Filters<"Fluxo de caixa">,
): Promise<ExportTable> {
  const data = await finance(db, actor).analytics({ year: filters.year, now });
  return {
    headings: ["Mês", "Cobranças", "Recebido", "Saldo atual das cobranças"],
    rows: data.months.map((row) => [
      row.month,
      money(row.expectedCents),
      row.month > data.asOf.slice(0, ISO_MONTH_LENGTH) ? "" : money(row.receivedCents),
      money(row.balanceCents),
    ]),
  };
}

async function closingsExport(
  { db, now, actor }: ExportContext,
  filters: Filters<"Contratos fechados">,
): Promise<ExportTable> {
  const data = await finance(db, actor).contractClosings(filters.year, now);
  return {
    headings: [
      "Mês de fechamento",
      "Volume contratado",
      "Mensalidade equivalente",
      "Quantidade de contratos",
    ],
    rows: data.months
      .filter((row) => row.month <= data.asOf.slice(0, ISO_MONTH_LENGTH))
      .toReversed()
      .map((row) => [
        row.month,
        money(row.projectedCents),
        money(row.monthlyEquivalentCents),
        row.count,
      ]),
  };
}

async function catalogExport(
  { db, now }: ExportContext,
  filters: Filters<"Estágios">,
): Promise<ExportTable> {
  const data = await catalogDirectory(db, now);
  const term = filters.search.trim().toLocaleLowerCase("pt-BR");
  const rows: ExportValue[][] = [];
  for (const track of data.tracks) {
    if (!filters.legacy && track.status === "LEGACY") continue;
    const matches = track.name.toLocaleLowerCase("pt-BR").includes(term);
    const stages = track.stages.filter(
      (stage) =>
        (filters.legacy || stage.status !== "LEGACY") &&
        (matches ||
          (stage.name + " " + stage.internalCode).toLocaleLowerCase("pt-BR").includes(term)),
    );
    if (matches && stages.length === 0) rows.push([track.name, "", "", ""]);
    for (const stage of stages)
      rows.push([
        track.name,
        stage.name,
        stage.internalCode,
        stage.status === "LEGACY" ? text("Legado", "muted") : "Ativo",
      ]);
  }
  return { headings: ["Track", "Estágio", "Código", "Situação"], rows };
}

type StudentExportRow = Awaited<ReturnType<typeof listStudents>>["rows"][number];
type Score = Awaited<ReturnType<typeof readStudentHealthBatch>>[number];
function studentScore(score: Score | undefined): ExportValue {
  if (score?.score === null || score === undefined) return "—";
  const tones: Record<Score["level"], Tone> = {
    HEALTHY: "success",
    ATTENTION: "warning",
    PRIORITY: "danger",
    INSUFFICIENT_DATA: "muted",
  };
  return text(score.score, tones[score.level]);
}
function studentAttendance(attendance: StudentExportRow["attendance"]): ExportValue {
  if (attendance.percent === null) return "";
  const value = percent(attendance.percent);
  return attendance.flagged ? { ...value, tone: "danger" } : value;
}
function studentFinance(summary: StudentExportRow["finance"]): ExportValue {
  if (summary.kind === "overdue") return { ...money(summary.overdueCents), tone: "danger" };
  return summary.kind === "upToDate" ? text("Em dia", "success") : "";
}
function teacherActivity(departure: string | undefined, departed: boolean): ExportValue {
  if (departed) return text("Inativa", "muted");
  return departure ? text("Saída programada", "warning") : text("Ativa", "success");
}
function leadFormat(format: string | null): string {
  if (format === "ONLINE") return "Online";
  return format ? "Presencial" : "";
}
function leadStatus(status: string): ExportValue {
  if (status === "ENROLLED") return text("Matriculado", "success");
  return status === "ARCHIVED" ? text("Arquivado", "muted") : "Ativo";
}
function installmentStatus(
  row: {
    suspendedUntil?: string | null | undefined;
    collectibleBalanceCents: number;
    status: string;
    paidAmountCents: number;
    dueDate: string;
  },
  today: string,
): ExportValue {
  if (row.suspendedUntil && row.suspendedUntil >= today && row.collectibleBalanceCents > 0)
    return text("Suspensa", "muted");
  if (row.status === "OVERDUE")
    return text(row.paidAmountCents ? "Parcial · Vencida" : "Vencida", "danger");
  if (row.status === "PAID") return text("Paga", "success");
  if (row.status === "WAIVED") return text("Dispensada", "muted");
  if (row.paidAmountCents) return text("Parcial", "warning");
  return row.dueDate === today ? text("Vence hoje", "warning") : "A vencer";
}
