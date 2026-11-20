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
  type DataTableState,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { abbreviatedPersonName } from "~/lib/format";
import { paymentPlanLabel } from "./contract-form-model";
import type { ContractFilters } from "./contract-filters";

const PAGE_SIZE = 25;
const MILLISECONDS_PER_DAY = 86_400_000;
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
  const days = (Date.parse(end) - Date.parse(saoPauloDateOnly(new Date()))) / MILLISECONDS_PER_DAY;
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
              {placement.description ?? placement.stageCode}
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
  "grid gap-3 px-4 py-3 @min-[46rem]:grid-cols-[7rem_minmax(0,1fr)_10rem] @min-[46rem]:items-center @min-[46rem]:gap-5 [&>a]:justify-self-start @min-[46rem]:[&>a]:justify-self-end";
const facts =
  "grid min-w-0 gap-3 @min-[30rem]:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] @min-[46rem]:gap-x-6";
const caption = "mb-1 block text-xs text-muted-foreground";
const contractLabel = "flex items-center gap-2 text-sm font-semibold text-muted-foreground";

function ContractGroup({
  rows,
  followUp,
}: {
  rows: ContractRow[];
  followUp: boolean;
}): ReactElement {
  const first = rows[0]!;
  const history = rows.flatMap((row) => row.materials);
  const href = `/alunos/${first.student.id}?secao=financeiro`;
  return (
    <section
      aria-labelledby={`contract-group-${first.student.id}`}
      className="@container overflow-hidden rounded-lg border border-border bg-card"
    >
      <header className="flex flex-wrap items-center gap-3 border-b border-border bg-muted px-4 py-2">
        <StudentAvatar colorKey={first.student.id} name={first.student.fullName} size="sm" />
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-4">
          <h2 id={`contract-group-${first.student.id}`} className="font-display font-semibold">
            {first.student.fullName}
          </h2>
          <span className="text-xs text-muted-foreground">
            {first.student.placements
              .map((placement) =>
                [placement.modality, placement.description ?? placement.stageCode]
                  .filter(Boolean)
                  .join(" · "),
              )
              .join(" · ")}
          </span>
        </div>
      </header>
      <div className="divide-y divide-border">
        {rows
          .filter((row) => !followUp || row.renewalPending || (row === first && row.materialDue))
          .map((row) => (
            <section key={row.id} className="divide-y divide-border">
              {(!followUp || row.renewalPending) && <ContractTerms row={row} href={href} />}
              {(!followUp || (row === first && row.materialDue)) && (
                <ContractMaterial
                  row={row}
                  purchases={followUp ? history : row.materials}
                  showPlanned={!followUp}
                  href={href}
                />
              )}
            </section>
          ))}
      </div>
    </section>
  );
}

function ContractTerms({ row, href }: { row: ContractRow; href: string }): ReactElement {
  return (
    <div className={contractLine}>
      <h3 className={contractLabel}>
        <FileText aria-hidden="true" size={16} />
        Contrato
      </h3>
      <div className={facts}>
        <div>
          <span className={caption}>Vigência</span>
          <div className="flex flex-wrap items-center gap-2">
            <strong title={termHint(row.endsOn)}>
              {shortCivilDate(row.startsOn)} → {shortCivilDate(row.endsOn)}
            </strong>
            {row.renewalPending && <Badge variant="warning">{termHint(row.endsOn)}</Badge>}
          </div>
        </div>
        <div>
          <span className={caption}>Mensalidades</span>
          <div className="flex flex-wrap items-center gap-2">
            <span className="whitespace-nowrap text-sm">
              {paymentPlanLabel(row.installmentCount, row.uniformInstallmentAmountCents)}
            </span>
            {row.status !== "INADIMPLENTE" && <ContractFinancialStatus row={row} />}
          </div>
        </div>
      </div>
      <Link
        className={buttonVariants({
          variant: row.renewalPending ? "primary" : "secondary",
          size: "sm",
        })}
        href={row.renewalPending ? href + "&renovarContrato=" + row.id : href}
      >
        {row.renewalPending ? <RotateCw aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
        {row.renewalPending ? "Rematricular" : "Abrir financeiro"}
      </Link>
    </div>
  );
}

function ContractMaterial({
  row,
  purchases,
  showPlanned,
  href,
}: {
  row: ContractRow;
  purchases: ContractRow["materials"];
  showPlanned: boolean;
  href: string;
}): ReactElement {
  return (
    <div className={contractLine}>
      <h3 className={contractLabel}>
        <BookOpen aria-hidden="true" size={16} />
        Material
      </h3>
      <div className={facts}>
        <div className="min-w-0 text-sm">
          {row.materialDue && (
            <>
              <span className={caption}>Próximo livro</span>
              <div className="flex flex-wrap items-center gap-2">
                <strong>{row.materialDue}</strong>
                <Badge variant="info">A adquirir</Badge>
              </div>
            </>
          )}
          {showPlanned &&
            row.plannedBooks
              ?.filter(
                (book) => !book.acquired && (!row.materialDue || book.name !== row.materialDue),
              )
              .map((book) => (
                <p key={book.semester}>
                  {book.name ?? "Livro a definir"} ·{" "}
                  {book.acquisitionSemester
                    ? `Pagamento no ${book.acquisitionSemester}º semestre`
                    : "Data de pagamento em aberto"}
                </p>
              ))}
          {!row.materialDue && !row.plannedBooks?.some((book) => !book.acquired) && (
            <>
              <span className={caption}>Próximo livro</span>
              <p className="text-muted-foreground">Sem aquisição prevista</p>
            </>
          )}
        </div>
        <div className="min-w-0 text-sm">
          <span className={caption}>Livros anteriores</span>
          {purchases.map((material) => (
            <p key={material.id}>
              {material.name} · {material.paymentLabel}
            </p>
          ))}
          {purchases.length === 0 && (
            <p className="text-muted-foreground">Nenhuma aquisição registrada</p>
          )}
        </div>
      </div>
      <Link
        className={buttonVariants({ variant: "secondary", size: "sm" })}
        href={href + "&material=1"}
      >
        Conferir material
        <ArrowRight aria-hidden="true" />
      </Link>
    </div>
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
  const filtered = [
    filters.followUp,
    filters.materialState,
    filters.scheduleType,
    search.trim(),
    payerId,
    studentId,
    startsFrom,
    endsTo,
    status,
  ].some(Boolean);
  const groups = list.data ? groupContracts(list.data.rows) : undefined;
  if (list.data && groups && groups.length > 0 && !list.isError) {
    return (
      <ContractGroups
        groups={groups}
        total={list.data.total}
        fetching={list.isFetching}
        filters={filters}
      />
    );
  }
  return (
    <DataTable<{ id: string; rows: ContractRow[] }>
      label="Contratos mensais"
      columns={[
        {
          id: "student",
          header: "Aluno e contratos",
          cell: (group) => <ContractGroup rows={group.rows} followUp={filters.followUp} />,
        },
      ]}
      state={contractListState({ groups, filtered, failed: list.isError })}
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

type StudentContractGroup = { id: string; rows: ContractRow[] };

function groupContracts(rows: ContractRow[]): StudentContractGroup[] {
  const byStudent = new Map<string, ContractRow[]>();
  for (const row of rows) {
    const contracts = byStudent.get(row.student.id);
    if (contracts) contracts.push(row);
    else byStudent.set(row.student.id, [row]);
  }
  return Array.from(byStudent, ([id, contracts]) => ({ id, rows: contracts }));
}

function contractListState({
  groups,
  filtered,
  failed,
}: {
  groups: StudentContractGroup[] | undefined;
  filtered: boolean;
  failed: boolean;
}): DataTableState<StudentContractGroup> {
  if (failed) return { kind: "error" };
  if (groups === undefined) return { kind: "loading" };
  if (groups.length > 0) return { kind: "data", rows: groups };
  return { kind: filtered ? "noResults" : "empty" };
}

function ContractGroups({
  groups,
  total,
  fetching,
  filters,
}: {
  groups: StudentContractGroup[];
  total: number;
  fetching: boolean;
  filters: ContractFilters;
}): ReactElement {
  return (
    <TableContainer
      viewportBound
      className="border-0 bg-transparent"
      aria-busy={fetching}
      footer={
        <TablePagination
          page={filters.page}
          pageSize={PAGE_SIZE}
          pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))}
          totalItems={total}
          onPageChange={filters.setPage}
          itemLabel={{ singular: "aluno", plural: "alunos" }}
        />
      }
    >
      <div className="w-0 min-w-full space-y-3 pb-3 pr-3">
        {groups.map((group) => (
          <ContractGroup key={group.id} rows={group.rows} followUp={filters.followUp} />
        ))}
      </div>
    </TableContainer>
  );
}
