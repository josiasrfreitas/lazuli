"use client";
import { useState, type ReactElement } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { useRouter } from "next/navigation";
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { Plus } from "lucide-react";
import {
  Button,
  DataTable,
  DataTablePage,
  Input,
  SegmentedControl,
  SegmentedControlItem,
  type DataTableState,
} from "@lazuli/ui";
import { studentPaginationPolicy } from "@lazuli/validators";
import { trpc, type QueryResult } from "~/lib/trpc";
import { tablePaginationPropsFor, useUrlPagination } from "~/lib/pagination";
import { LeadCaptureDialog } from "./lead-capture-dialog";
import { admissionColumns } from "./admission-columns";
import type { CandidateRow } from "./labels";

const followUpViews = ["ALL", "TODAY", "OVERDUE", "UNPLANNED"] as const;
const states = ["WAITING", "ENROLLED", "ARCHIVED", "ALL"] as const;
type CandidateQuery = QueryResult<RouterOutputs["admissions"]["list"]>;
export function AdmissionsPage(): ReactElement {
  const [params, setParams] = useQueryStates({
    retorno: parseAsStringLiteral(followUpViews).withDefault("ALL"),
    busca: parseAsString.withDefault(""),
    situacao: parseAsStringLiteral(states).withDefault("WAITING"),
  });
  const pagination = useUrlPagination(studentPaginationPolicy);
  const query = trpc.admissions.list.useQuery({
    followUp: params.retorno,
    search: params.busca,
    status: params.situacao,
    page: pagination.page,
    pageSize: pagination.pageSize,
  });
  const [creating, setCreating] = useState(false);
  return (
    <>
      <DataTablePage
        title="Leads"
        summary={
          query.data
            ? `${query.data.total} ${query.data.total === 1 ? "pessoa" : "pessoas"}`
            : undefined
        }
        controls={
          <AdmissionControls
            search={params.busca}
            onCreate={() => setCreating(true)}
            onSearch={(busca) => {
              void setParams({ busca });
              pagination.setPage(1);
            }}
          />
        }
      >
        <div className="flex h-full min-h-0 flex-col gap-4">
          <AdmissionFilters
            value={params.situacao}
            onChange={(situacao) => {
              void setParams({ situacao, retorno: "ALL" });
              pagination.setPage(1);
            }}
          />
          {params.situacao === "WAITING" && (
            <FollowUpFilters
              value={params.retorno}
              onChange={(retorno) => {
                void setParams({ retorno });
                pagination.setPage(1);
              }}
            />
          )}
          <AdmissionsTable
            query={query}
            pagination={pagination}
            filtered={Boolean(params.busca) || params.retorno !== "ALL"}
          />
        </div>
      </DataTablePage>
      {creating && <LeadCaptureDialog onClose={() => setCreating(false)} />}
    </>
  );
}
function AdmissionControls({
  search,
  onSearch,
  onCreate,
}: {
  search: string;
  onSearch: (search: string) => void;
  onCreate: () => void;
}): ReactElement {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-full sm:w-56">
        <Input
          name="candidate-search"
          aria-label="Buscar lead"
          placeholder="Nome, telefone ou e-mail"
          autoComplete="off"
          size="compact-responsive"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
        />
      </div>
      <Button size="compact-responsive" onClick={onCreate}>
        <Plus />
        Novo lead
      </Button>
    </div>
  );
}
function AdmissionFilters({
  value,
  onChange,
}: {
  value: (typeof states)[number];
  onChange: (value: (typeof states)[number]) => void;
}): ReactElement {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <SegmentedControl
        aria-label="Situação do lead"
        size="sm"
        value={value}
        onValueChange={(next) => {
          if (states.includes(next as (typeof states)[number]))
            onChange(next as (typeof states)[number]);
        }}
      >
        <SegmentedControlItem value="WAITING">Em acompanhamento</SegmentedControlItem>
        <SegmentedControlItem value="ENROLLED">Matriculados</SegmentedControlItem>
        <SegmentedControlItem value="ARCHIVED">Arquivados</SegmentedControlItem>
        <SegmentedControlItem value="ALL">Todos</SegmentedControlItem>
      </SegmentedControl>
      <p className="text-caption text-muted-foreground">Do primeiro contato à turma certa.</p>
    </div>
  );
}
function tableState(query: CandidateQuery, filtered: boolean): DataTableState<CandidateRow> {
  if (query.isError) return { kind: "error" };
  if (!query.data) return { kind: "loading" };
  if (query.data.rows.length > 0) return { kind: "data", rows: query.data.rows };
  return { kind: filtered ? "noResults" : "empty" };
}
function AdmissionsTable({
  query,
  pagination,
  filtered,
}: {
  query: CandidateQuery;
  pagination: ReturnType<typeof useUrlPagination>;
  filtered: boolean;
}): ReactElement {
  const router = useRouter();
  return (
    <div className="min-h-0 flex-1">
      <DataTable
        label="Leads"
        columns={admissionColumns(query.data?.today ?? "")}
        state={tableState(query, filtered)}
        updating={query.isFetching}
        onRowClick={(row) => router.push(`/interessados/${row.id}`)}
        onRetry={() => void query.refetch()}
        empty={{
          title: "O próximo aluno começa por aqui",
          description:
            "Registre um interesse, encontre horários compatíveis e acompanhe a primeira aula.",
        }}
        errorTitle="Não foi possível carregar os leads"
        pagination={{
          ...tablePaginationPropsFor(pagination, query.data),
          itemLabel: { singular: "lead", plural: "leads" },
        }}
      />
    </div>
  );
}

function FollowUpFilters({
  value,
  onChange,
}: {
  value: (typeof followUpViews)[number];
  onChange: (value: (typeof followUpViews)[number]) => void;
}): ReactElement {
  return (
    <SegmentedControl
      aria-label="Fila de retornos"
      size="sm"
      value={value}
      onValueChange={(next) => {
        if (followUpViews.includes(next as (typeof followUpViews)[number]))
          onChange(next as (typeof followUpViews)[number]);
      }}
    >
      <SegmentedControlItem value="ALL">Todos os retornos</SegmentedControlItem>
      <SegmentedControlItem value="TODAY">Hoje</SegmentedControlItem>
      <SegmentedControlItem value="OVERDUE">Em atraso</SegmentedControlItem>
      <SegmentedControlItem value="UNPLANNED">Sem próximo passo</SegmentedControlItem>
    </SegmentedControl>
  );
}
