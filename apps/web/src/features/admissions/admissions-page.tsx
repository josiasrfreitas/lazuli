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
import { CandidateDialog } from "./candidate-dialog";
import { admissionColumns } from "./admission-columns";
import type { CandidateRow } from "./labels";

const states = ["WAITING", "ENROLLED", "ARCHIVED", "ALL"] as const;
type CandidateQuery = QueryResult<RouterOutputs["admissions"]["list"]>;
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
              void setParams({ situacao });
              pagination.setPage(1);
            }}
          />
          <AdmissionsTable query={query} pagination={pagination} search={params.busca} />
        </div>
      </DataTablePage>
      {creating && <CandidateDialog onClose={() => setCreating(false)} />}
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
          aria-label="Buscar interessado"
          placeholder="Nome, telefone ou e-mail"
          autoComplete="off"
          size="compact-responsive"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
        />
      </div>
      <Button size="compact-responsive" onClick={onCreate}>
        <Plus />
        Novo interessado
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
        aria-label="Situação do interessado"
        size="sm"
        value={value}
        onValueChange={(next) => {
          if (states.includes(next as (typeof states)[number]))
            onChange(next as (typeof states)[number]);
        }}
      >
        <SegmentedControlItem value="WAITING">Aguardando</SegmentedControlItem>
        <SegmentedControlItem value="ENROLLED">Matriculados</SegmentedControlItem>
        <SegmentedControlItem value="ARCHIVED">Arquivados</SegmentedControlItem>
        <SegmentedControlItem value="ALL">Todos</SegmentedControlItem>
      </SegmentedControl>
      <p className="text-caption text-muted-foreground">Do primeiro contato à turma certa.</p>
    </div>
  );
}
function tableState(query: CandidateQuery, search: string): DataTableState<CandidateRow> {
  if (query.isError) return { kind: "error" };
  if (!query.data) return { kind: "loading" };
  if (query.data.rows.length > 0) return { kind: "data", rows: query.data.rows };
  return { kind: search ? "noResults" : "empty" };
}
function AdmissionsTable({
  query,
  pagination,
  search,
}: {
  query: CandidateQuery;
  pagination: ReturnType<typeof useUrlPagination>;
  search: string;
}): ReactElement {
  const router = useRouter();
  return (
    <div className="min-h-0 flex-1">
      <DataTable
        label="Interessados"
        columns={admissionColumns(query.data?.today ?? "")}
        state={tableState(query, search)}
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
  );
}
