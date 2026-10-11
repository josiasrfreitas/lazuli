"use client";
import { useState, type ReactElement } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { Plus } from "lucide-react";
import {
  Badge,
  Button,
  DataTable,
  DataTablePage,
  Input,
  SegmentedControl,
  SegmentedControlItem,
  type DataTableColumn,
  type DataTableState,
} from "@lazuli/ui";
import { studentPaginationPolicy } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { tablePaginationPropsFor, useUrlPagination } from "~/lib/pagination";
import { CandidateDialog } from "./candidate-dialog";
import { dateLabel, dateOnly, statusLabels, type CandidateRow } from "./labels";

const states = ["WAITING", "ENROLLED", "ARCHIVED", "ALL"] as const;
export function AdmissionsPage(): ReactElement {
  const [params, setParams] = useQueryStates({
    busca: parseAsString.withDefault(""),
    situacao: parseAsStringLiteral(states).withDefault("WAITING"),
  });
  const pagination = useUrlPagination(studentPaginationPolicy);
  const query = trpc.admissions.list.useQuery({
    search: params.busca,
    status: params.situacao,
    page: pagination.page,
    pageSize: pagination.pageSize,
  });
  const [creating, setCreating] = useState(false);
  const router = useRouter();
  const columns: DataTableColumn<CandidateRow>[] = [
    {
      id: "name",
      header: "Interessado",
      width: "wide",
      cell: (row) => (
        <div className="grid gap-1">
          <Link
            className="font-medium underline-offset-4 hover:underline"
            href={`/interessados/${row.id}`}
          >
            {row.fullName}
          </Link>
          <span className="text-caption text-muted-foreground">{row.phone || row.email}</span>
        </div>
      ),
    },
    {
      id: "interest",
      header: "Interesse",
      width: "standard",
      cell: (row) => (
        <div className="grid gap-1">
          <span>{row.scheduleType === "REGULAR" ? "Regular" : "Personalizado"}</span>
          <span className="text-caption text-muted-foreground">
            {row.format === "IN_PERSON" ? "Presencial" : "Online"}
          </span>
        </div>
      ),
    },
    {
      id: "stage",
      header: "Estágio indicado",
      width: "wide",
      cell: (row) => (
        <span className={row.stage ? "" : "text-muted-foreground"}>
          {row.stage?.name ?? "Aguardando nivelamento"}
        </span>
      ),
    },
    {
      id: "availability",
      header: "Disponibilidade",
      width: "standard",
      cell: (row) =>
        dateOnly(row.availableUntil) < (query.data?.today ?? "") && row.status === "WAITING" ? (
          <Badge variant="warning">Confirmar horários</Badge>
        ) : (
          <span className="text-caption text-muted-foreground">
            Até {dateLabel(row.availableUntil)}
          </span>
        ),
    },
    {
      id: "status",
      header: "Situação",
      width: "wide",
      cell: (row) => (
        <Badge variant={row.status === "ENROLLED" ? "success" : "neutral"}>
          {statusLabels[row.status]}
        </Badge>
      ),
    },
  ];
  let state: DataTableState<CandidateRow> = { kind: "loading" };
  if (query.isError) state = { kind: "error" };
  else if (query.data)
    state = query.data.rows.length
      ? { kind: "data", rows: query.data.rows }
      : { kind: params.busca ? "noResults" : "empty" };
  return (
    <>
      <DataTablePage
        title="Interessados"
        summary={
          query.data
            ? `${query.data.total} ${query.data.total === 1 ? "pessoa" : "pessoas"}`
            : undefined
        }
        controls={
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-full sm:w-56">
              <Input
                name="candidate-search"
                aria-label="Buscar interessado"
                placeholder="Nome, telefone ou e-mail"
                autoComplete="off"
                size="compact-responsive"
                value={params.busca}
                onChange={(event) => {
                  void setParams({ busca: event.target.value });
                  pagination.setPage(1);
                }}
              />
            </div>
            <Button size="compact-responsive" onClick={() => setCreating(true)}>
              <Plus />
              Novo interessado
            </Button>
          </div>
        }
      >
        <div className="flex h-full min-h-0 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SegmentedControl
              aria-label="Situação do interessado"
              size="sm"
              value={params.situacao}
              onValueChange={(value) => {
                if (states.includes(value as (typeof states)[number])) {
                  void setParams({ situacao: value as (typeof states)[number] });
                  pagination.setPage(1);
                }
              }}
            >
              <SegmentedControlItem value="WAITING">Aguardando</SegmentedControlItem>
              <SegmentedControlItem value="ENROLLED">Matriculados</SegmentedControlItem>
              <SegmentedControlItem value="ARCHIVED">Arquivados</SegmentedControlItem>
              <SegmentedControlItem value="ALL">Todos</SegmentedControlItem>
            </SegmentedControl>
            <p className="text-caption text-muted-foreground">Do primeiro contato à turma certa.</p>
          </div>
          <div className="min-h-0 flex-1">
            <DataTable
              label="Interessados"
              columns={columns}
              state={state}
              updating={query.isFetching}
              onRowClick={(row) => router.push(`/interessados/${row.id}`)}
              onRetry={() => void query.refetch()}
              empty={{
                title: "O próximo aluno começa por aqui",
                description:
                  "Registre um interesse, encontre horários compatíveis e acompanhe a primeira aula.",
              }}
              errorTitle="Não foi possível carregar os interessados"
              pagination={{
                ...tablePaginationPropsFor(pagination, query.data),
                itemLabel: { singular: "interessado", plural: "interessados" },
              }}
            />
          </div>
        </div>
      </DataTablePage>
      {creating && <CandidateDialog onClose={() => setCreating(false)} />}
    </>
  );
}
