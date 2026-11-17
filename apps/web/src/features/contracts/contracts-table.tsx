"use client";

import { saoPauloDateOnly } from "@lazuli/domain";
import { StudentAvatar } from "~/components/student-avatar";
import type { CSSProperties, ReactElement } from "react";
import { BookOpen, FileText, RotateCw, ArrowRight } from "lucide-react";
import Link from "next/link";
import type { RouterOutputs } from "@lazuli/api";
import {
  Badge,
  buttonVariants,
  TableContainer,
  TablePagination,
  DataTable,
  type BadgeVariant,
  type DataTableColumn,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { abbreviatedPersonName } from "~/lib/format";
import { paymentPlanLabel } from "./contract-form-model";
import type { ContractFilters } from "./contract-filters";

const PAGE_SIZE = 25;
const FULL_SCHOLARSHIP_PERCENT = 100;
export type ContractRow = RouterOutputs["finance"]["listContracts"]["rows"][number];

const STATUS_LABELS: Record<ContractRow["status"], string> = {
  INADIMPLENTE: "Inadimplente",
  EM_DIA: "Em dia",
  QUITADO: "Quitado",
  SEM_SALDO: "Sem saldo a cobrar",
  CANCELADO: "Cancelada",
};
const STATUS_VARIANTS: Record<ContractRow["status"], BadgeVariant> = {
  INADIMPLENTE: "destructive",
  EM_DIA: "success",
  QUITADO: "neutral",
  SEM_SALDO: "neutral",
  CANCELADO: "neutral",
};

function ContractFinancialStatus({ row }: { row: ContractRow }): ReactElement {
  return <Badge variant={STATUS_VARIANTS[row.status]}>{STATUS_LABELS[row.status]}</Badge>;
}

const PERCENT = 100;

export function ContractPaymentProgress({
  progress,
}: {
  progress: ContractRow["paymentProgress"];
}): ReactElement {
  const { paid, total, waived, cancelled } = progress;
  if (total === 0)
    return <span className="text-caption text-muted-foreground">Sem parcelas de mensalidade</span>;
  const label = `${paid} de ${total} pagas`;
  const exceptions = [
    waived > 0 ? `${waived} ${waived === 1 ? "dispensada" : "dispensadas"}` : null,
    cancelled > 0 ? `${cancelled} ${cancelled === 1 ? "cancelada" : "canceladas"}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-1.5">
      <span aria-hidden="true" className="font-numeric whitespace-nowrap">
        {label}
      </span>
      <div
        role="progressbar"
        aria-label="Parcelas pagas"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={paid}
        aria-valuetext={exceptions ? `${label}; ${exceptions}` : label}
        className="h-1.5 w-full overflow-hidden rounded-full bg-secondary"
      >
        <div
          className="h-full w-(--payment-progress) rounded-full bg-interactive"
          style={{ "--payment-progress": `${(paid / total) * PERCENT}%` } as CSSProperties}
        />
      </div>
    </div>
  );
}

const MONTH_INDEX_OFFSET = 1;
const SHORT_YEAR_DIGITS = 2;
const MONTH_ABBREVIATIONS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
] as const;

function shortCivilDate(value: string): string {
  const [year, month, day] = value.split("-");
  return `${day} ${MONTH_ABBREVIATIONS[Number(month) - MONTH_INDEX_OFFSET]} ${year?.slice(-SHORT_YEAR_DIGITS)}`;
}

const COLUMN_WIDTHS = {
  student: "medium",
  status: "narrow",
  term: "medium",
  placement: "standard",
  amount: "standard",
  paymentProgress: "standard",
  payer: "narrow",
} as const satisfies Record<string, NonNullable<DataTableColumn<ContractRow>["width"]>>;

function termHint(end: string): string {
  const days = (Date.parse(end) - Date.parse(saoPauloDateOnly(new Date()))) / 86_400_000;
  if (days === 0) return "A vigência termina hoje";
  const duration = Math.abs(days) === 1 ? "1 dia" : `${Math.abs(days)} dias`;
  return days > 0 ? `Termina em ${duration}` : `Terminou há ${duration}`;
}

export const contractColumns: readonly DataTableColumn<ContractRow>[] = [
  {
    id: "student",
    header: "Aluno",
    width: COLUMN_WIDTHS.student,
    cell: (row) => (
      <div className="flex items-center gap-3">
        <StudentAvatar colorKey={row.student.id} name={row.student.fullName} size="sm" />
        <span className="min-w-0 font-medium break-words whitespace-normal">
          {row.student.fullName}
        </span>
      </div>
    ),
  },
  {
    id: "status",
    header: "Status",
    width: COLUMN_WIDTHS.status,
    cell: (row) => <ContractFinancialStatus row={row} />,
  },
  {
    id: "term",
    header: "Vigência",
    width: COLUMN_WIDTHS.term,
    cell: (row) => (
      <span
        title={termHint(row.endsOn)}
        tabIndex={0}
        aria-label={`${shortCivilDate(row.startsOn)} a ${shortCivilDate(row.endsOn)}. ${termHint(row.endsOn)}`}
        className="font-numeric whitespace-nowrap text-muted-foreground"
      >
        <time dateTime={row.startsOn}>{shortCivilDate(row.startsOn)}</time>
        {" → "}
        <time dateTime={row.endsOn}>{shortCivilDate(row.endsOn)}</time>
      </span>
    ),
  },
  {
    id: "placement",
    header: "Estágio / turma",
    width: COLUMN_WIDTHS.placement,
    cell: (row) =>
      row.student.placements.length > 0
        ? row.student.placements.map((placement) => (
            <span
              key={`${placement.classCode}-${placement.stageCode}`}
              className="block break-words"
            >
              {placement.stageCode} · {placement.classCode}
            </span>
          ))
        : "—",
  },
  {
    id: "amount",
    header: "Plano",
    width: COLUMN_WIDTHS.amount,
    numeric: true,
    cell: (row) => (
      <div className="grid gap-1 font-numeric">
        <span>{paymentPlanLabel(row.installmentCount, row.uniformInstallmentAmountCents)}</span>
        {row.scholarshipPct > 0 && (
          <span className="text-caption text-muted-foreground">
            Bolsa{" "}
            {row.scholarshipPct === FULL_SCHOLARSHIP_PERCENT
              ? "integral"
              : `de ${row.scholarshipPct.toLocaleString("pt-BR")}%`}
          </span>
        )}
      </div>
    ),
  },
  {
    id: "paymentProgress",
    header: "Pagamento",
    width: COLUMN_WIDTHS.paymentProgress,
    cell: (row) => <ContractPaymentProgress progress={row.paymentProgress} />,
  },
  {
    id: "payer",
    header: "Pagador",
    width: COLUMN_WIDTHS.payer,
    cell: (row) => <span title={row.payer.name}>{abbreviatedPersonName(row.payer.name)}</span>,
  },
];

const contractLine =
  "grid gap-2 px-4 py-3 sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:items-center sm:gap-4 [&>a]:justify-self-start sm:[&>a]:justify-self-end";
const contractLabel = "flex items-center gap-2 text-sm font-semibold text-muted-foreground";

function ContractGroup({ rows }: { rows: ContractRow[] }): ReactElement {
  const first = rows[0]!;
  const href = `/alunos/${first.student.id}?secao=financeiro`;
  return (
    <section
      aria-labelledby={`contract-group-${first.student.id}`}
      className="overflow-hidden rounded-lg border border-border bg-card"
    >
      <header className="flex flex-wrap items-center gap-3 border-b border-border bg-muted px-4 py-2">
        <StudentAvatar colorKey={first.student.id} name={first.student.fullName} size="sm" />
        <div className="min-w-0 flex-1">
          <h2 id={`contract-group-${first.student.id}`} className="font-display font-semibold">
            {first.student.fullName}
          </h2>
          <span className="text-xs text-muted-foreground">
            {first.student.placements
              .map((p) => [p.modality, p.classCode, p.stageCode].filter(Boolean).join(" · "))
              .join(" · ")}
          </span>
        </div>
      </header>
      <div className="divide-y divide-border">
        {rows.map((row) => (
          <section key={row.id} className="divide-y divide-border">
            <div className={contractLine}>
              <h3 className={contractLabel}>
                <FileText aria-hidden="true" size={16} />
                Contrato
              </h3>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <strong title={termHint(row.endsOn)}>
                    {shortCivilDate(row.startsOn)} → {shortCivilDate(row.endsOn)}
                  </strong>
                  {row.renewalPending && <Badge variant="warning">{termHint(row.endsOn)}</Badge>}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  {paymentPlanLabel(row.installmentCount, row.uniformInstallmentAmountCents)}
                  <ContractFinancialStatus row={row} />
                </div>
              </div>
              <Link
                className={buttonVariants({
                  variant: row.renewalPending ? "primary" : "secondary",
                  size: "sm",
                })}
                href={row.renewalPending ? href + "&renovarContrato=" + row.id : href}
              >
                {row.renewalPending ? (
                  <RotateCw aria-hidden="true" />
                ) : (
                  <ArrowRight aria-hidden="true" />
                )}
                {row.renewalPending ? "Rematricular" : "Abrir financeiro"}
              </Link>
            </div>
            <div className={contractLine}>
              <h3 className={contractLabel}>
                <BookOpen aria-hidden="true" size={16} />
                Material
              </h3>
              <div className="min-w-0 space-y-1 text-sm">
                {row.materialDue && (
                  <p>
                    <span className="text-muted-foreground">Próximo livro · </span>
                    <strong>{row.materialDue}</strong> <Badge variant="info">A adquirir</Badge>
                  </p>
                )}
                {row.plannedBooks?.map((book) => {
                  const sale = book.stageId
                    ? row.materials.find((material) => material.stageIds?.includes(book.stageId!))
                    : undefined;
                  return (
                    <p key={book.semester}>
                      <span className="text-muted-foreground">{book.semester}º semestre · </span>
                      {book.name ?? "Livro a definir"} ·{" "}
                      {book.acquired
                        ? ["Adquirido", sale?.paymentLabel].filter(Boolean).join(" · ")
                        : book.acquisitionSemester
                          ? `Aquisição no ${book.acquisitionSemester}º semestre`
                          : "Aquisição em aberto"}
                    </p>
                  );
                })}
                {row.materials
                  .filter(
                    (material) =>
                      !material.stageIds?.length ||
                      !material.stageIds.every((id) =>
                        row.plannedBooks?.some((book) => book.stageId === id),
                      ),
                  )
                  .map((material) => (
                    <p key={material.id}>
                      {material.name} · {material.paymentLabel}
                    </p>
                  ))}
                {!row.plannedBooks?.length && !row.materials.length && (
                  <p className="text-muted-foreground">Nenhuma aquisição registrada</p>
                )}
              </div>
              <Link
                className={buttonVariants({ variant: "secondary", size: "sm" })}
                href={href + "&material=1"}
              >
                Conferir material
                <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

export function ContractsTable({ filters }: { filters: ContractFilters }): ReactElement {
  const { page, search, payerId, studentId, startsFrom, endsTo, status } = filters;
  const list = trpc.finance.listContracts.useQuery({
    page,
    grouped: true,
    materialState: filters.materialState,
    followUp: filters.followUp,
    query: search.trim(),
    scheduleType: filters.scheduleType,
    payerId,
    studentId,
    startsFrom,
    endsTo,
    status,
  });
  const filtered = Boolean(
    filters.followUp ||
    filters.materialState ||
    filters.scheduleType ||
    search.trim() ||
    payerId ||
    studentId ||
    startsFrom ||
    endsTo ||
    status,
  );
  const byStudent = new Map<string, ContractRow[]>();
  for (const row of list.data?.rows ?? []) {
    const rows = byStudent.get(row.student.id);
    if (rows) rows.push(row);
    else byStudent.set(row.student.id, [row]);
  }
  const groups = list.data && Array.from(byStudent, ([id, rows]) => ({ id, rows }));
  if (list.data && groups?.length && !list.isError) {
    return (
      <TableContainer
        viewportBound
        className="border-0 bg-transparent"
        aria-busy={list.isFetching}
        footer={
          <TablePagination
            page={page}
            pageSize={PAGE_SIZE}
            pageCount={Math.max(1, Math.ceil(list.data.total / PAGE_SIZE))}
            totalItems={list.data.total}
            onPageChange={filters.setPage}
            itemLabel={{ singular: "aluno", plural: "alunos" }}
          />
        }
      >
        <div className="w-0 min-w-full space-y-3 pb-3 pr-3">
          {groups.map((group) => (
            <ContractGroup key={group.id} rows={group.rows} />
          ))}
        </div>
      </TableContainer>
    );
  }
  return (
    <DataTable<{ id: string; rows: ContractRow[] }>
      label="Contratos mensais"
      columns={[
        {
          id: "student",
          header: "Aluno e contratos",
          cell: (group) => <ContractGroup rows={group.rows} />,
        },
      ]}
      state={
        list.isError
          ? { kind: "error" }
          : !groups
            ? { kind: "loading" }
            : groups.length
              ? { kind: "data", rows: groups }
              : { kind: filtered ? "noResults" : "empty" }
      }
      errorTitle="Não foi possível carregar os contratos"
      empty={{
        title: "Nenhum contrato cadastrado",
        description: "Crie o primeiro contrato para começar.",
      }}
      onRetry={() => void list.refetch()}
      pagination={{
        page,
        pageSize: PAGE_SIZE,
        onPageChange: filters.setPage,
        itemLabel: { singular: "aluno", plural: "alunos" },
        ...(list.data
          ? {
              pageCount: Math.max(1, Math.ceil(list.data.total / PAGE_SIZE)),
              totalItems: list.data.total,
            }
          : { loading: true }),
      }}
    />
  );
}
