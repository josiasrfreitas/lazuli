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
  for (let page = 2; page <= first.pageCount; page++)
    for (const row of (await read(page)).rows) first.rows.push(row);
  return { headings, rows: first.rows };
}
const text = (value: string | number, tone: Tone) => ({ value, tone });
const date = (iso: string) => iso.split("-").reverse().join("/");
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
export async function readExport(
  db: TransactionClient,
  source: TableExportRequest["source"],
  actor: string,
  now: Date,
): Promise<ExportTable> {
  const today = saoPauloDateOnly(now);
  switch (source.listing) {
    case "Alunos":
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
            values: { ...source.filters, page, pageSize: 50, now, staffUserId: actor },
          });
          const scores = new Map(
            (
              await readStudentHealthBatch({ database: db, ids: result.rows.map((r) => r.id), now })
            ).map((row) => [row.studentId, row]),
          );
          return {
            ...result,
            rows: result.rows.map((r) => {
              const score = scores.get(r.id);
              return [
                r.fullName,
                {
                  ACTIVE: "Ativo",
                  SUSPENDED: "Trancado",
                  DROPPED: "Desistente",
                  INACTIVE: "Inativo",
                }[r.status],
                r.isScholarshipStudent ? "Bolsista" : "Sem bolsa",
                r.enrollment?.classCode ?? "",
                r.enrollment?.scheduleLabel ?? "",
                r.enrollment?.teacherName ?? "",
                score?.score == null
                  ? "—"
                  : text(
                      score.score,
                      (
                        {
                          HEALTHY: "success",
                          ATTENTION: "warning",
                          PRIORITY: "danger",
                          INSUFFICIENT_DATA: "muted",
                        } as const
                      )[score.level],
                    ),
                r.attendance.percent === null
                  ? ""
                  : {
                      ...percent(r.attendance.percent),
                      ...(r.attendance.flagged ? { tone: "danger" as const } : {}),
                    },
                r.finance.kind === "overdue"
                  ? { ...money(r.finance.overdueCents), tone: "danger" as const }
                  : r.finance.kind === "upToDate"
                    ? text("Em dia", "success")
                    : "",
              ];
            }),
          };
        },
      );
    case "Turmas":
      return pages(
        [
          "Turma",
          "Modalidade",
          "Formato",
          "Docente",
          "Estágio",
          "Horários",
          "Ocupação",
          "Capacidade",
        ],
        async (page) => {
          const result = await listClasses({
            database: db,
            values: { ...source.filters, page },
            now,
          });
          return {
            ...result,
            rows: result.rows.map((r) => [
              r.portalClassName,
              r.scheduleType === "REGULAR" ? "Regular" : "PPT",
              r.format === "ONLINE" ? "Online" : "Presencial",
              r.currentTeacher?.name ?? "Sem docente",
              r.sharedStage?.name ?? "Individual",
              r.scheduleSlots
                .map(
                  (s) =>
                    weekdays[s.weekday] +
                    " " +
                    s.startTime.toISOString().slice(11, 16) +
                    "–" +
                    s.endTime.toISOString().slice(11, 16),
                )
                .join(", "),
              text(
                r.occupancy,
                ({ normal: "success", high: "warning", over: "danger" } as const)[
                  classOccupancyLevel(r.occupancy, r.capacity)
                ],
              ),
              r.capacity,
            ]),
          };
        },
      );
    case "Docentes":
    case "Professores":
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
            input: { ...source.filters, page },
            now,
          });
          const scores = await teacherListScores(db, {
            ids: result.rows.map((row) => row.id),
            now,
          });
          return {
            ...result,
            rows: result.rows.map((r) => {
              const departure = r.teacherProfile?.departureDate?.toISOString().slice(0, 10);
              const departed = Boolean(departure && departure <= today);
              return [
                r.name,
                r.email,
                r.classCount,
                scores[r.id] ?? "Sem dados",
                r.monthlyHours.completedMinutes / 60,
                r.monthlyHours.plannedMinutes / 60,
                r.appointmentHours.completedMinutes / 60,
                r.appointmentHours.plannedMinutes / 60,
                departed
                  ? text("Inativa", "muted")
                  : departure
                    ? text("Saída programada", "warning")
                    : text("Ativa", "success"),
                r.isEnabled && (!departed || r.role === "ADMIN" || r.role === "SYSTEM_ADMIN")
                  ? "Habilitado"
                  : "Não habilitado",
              ];
            }),
          };
        },
      );
    case "Leads":
      return pages(
        ["Lead", "Telefone", "E-mail", "Interesse", "Estágio", "Formato", "Status", "Cadastro"],
        async (page) => {
          const result = await listCandidates(db, { input: { ...source.filters, page }, now });
          return {
            ...result,
            rows: result.rows.map((r) => [
              r.fullName,
              r.phone ?? "",
              r.email ?? "",
              { UNKNOWN: "Não informado", LOW: "Baixo", MEDIUM: "Médio", HIGH: "Alto" }[r.interest],
              r.stage?.name ??
                (r.englishExperience === "SOME" ? "Nivelamento pendente" : "A definir"),
              r.format === "ONLINE" ? "Online" : r.format ? "Presencial" : "",
              r.status === "ENROLLED"
                ? text("Matriculado", "success")
                : r.status === "ARCHIVED"
                  ? text("Arquivado", "muted")
                  : "Ativo",
              date(r.createdAt.toISOString().slice(0, 10)),
            ]),
          };
        },
      );
    case "Contratos":
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
          const r = await finance(db, actor).listContracts({ ...source.filters, page, now });
          return {
            pageCount: Math.ceil(r.total / r.pageSize),
            rows: r.rows.map((v) => [
              v.student.fullName,
              v.payer.name,
              date(v.startsOn),
              date(v.endsOn),
              v.installmentCount,
              v.paymentProgress.paid,
              percent(v.scholarshipPct / 100),
              {
                EM_DIA: text("Em dia", "success"),
                QUITADO: text("Quitado", "success"),
                INADIMPLENTE: text("Inadimplente", "danger"),
                SEM_SALDO: text("Sem saldo a cobrar", "muted"),
                CANCELADO: text("Cancelado", "muted"),
              }[v.status],
              v.renewalPending ? text("Sim", "warning") : "Não",
              v.materialDue ?? "",
            ]),
          };
        },
      );
    case "Recebíveis":
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
          const result = await finance(db, actor).installments({ ...source.filters, page }, now);
          const rows = "groups" in result ? result.groups.flatMap((g) => g.rows) : result.rows;
          return {
            ...result,
            rows: rows.map((r) => [
              r.payer.name,
              r.beneficiaries.map((b) => b.fullName).join(", "),
              origin[r.origin],
              r.sequenceNumber,
              date(r.dueDate),
              money(r.expectedAmountCents),
              money(r.paidAmountCents),
              money(r.collectibleBalanceCents),
              r.suspendedUntil && r.suspendedUntil >= today && r.collectibleBalanceCents > 0
                ? text("Suspensa", "muted")
                : r.status === "OVERDUE"
                  ? text(r.paidAmountCents ? "Parcial · Vencida" : "Vencida", "danger")
                  : r.status === "PAID"
                    ? text("Paga", "success")
                    : r.status === "WAIVED"
                      ? text("Dispensada", "muted")
                      : r.paidAmountCents
                        ? text("Parcial", "warning")
                        : r.dueDate === today
                          ? text("Vence hoje", "warning")
                          : "A vencer",
            ]),
          };
        },
      );
    case "Fluxo de caixa": {
      const data = await finance(db, actor).analytics({ year: source.filters.year, now });
      return {
        headings: ["Mês", "Cobranças", "Recebido", "Saldo atual das cobranças"],
        rows: data.months.map((r) => [
          r.month,
          money(r.expectedCents),
          r.month > data.asOf.slice(0, 7) ? "" : money(r.receivedCents),
          money(r.balanceCents),
        ]),
      };
    }
    case "Contratos fechados": {
      const data = await finance(db, actor).contractClosings(source.filters.year, now);
      return {
        headings: [
          "Mês de fechamento",
          "Volume contratado",
          "Mensalidade equivalente",
          "Quantidade de contratos",
        ],
        rows: data.months
          .filter((r) => r.month <= data.asOf.slice(0, 7))
          .reverse()
          .map((r) => [r.month, money(r.projectedCents), money(r.monthlyEquivalentCents), r.count]),
      };
    }
    case "Estágios": {
      const data = await catalogDirectory(db, now);
      const term = source.filters.search.trim().toLocaleLowerCase("pt-BR");
      const rows: ExportValue[][] = [];
      for (const track of data.tracks) {
        if (!source.filters.legacy && track.status === "LEGACY") continue;
        const matches = track.name.toLocaleLowerCase("pt-BR").includes(term);
        const stages = track.stages.filter(
          (s) =>
            (source.filters.legacy || s.status !== "LEGACY") &&
            (matches || (s.name + " " + s.internalCode).toLocaleLowerCase("pt-BR").includes(term)),
        );
        if (matches && !stages.length) rows.push([track.name, "", "", ""]);
        for (const s of stages)
          rows.push([
            track.name,
            s.name,
            s.internalCode,
            s.status === "LEGACY" ? text("Legado", "muted") : "Ativo",
          ]);
      }
      return { headings: ["Track", "Estágio", "Código", "Situação"], rows };
    }
  }
}
