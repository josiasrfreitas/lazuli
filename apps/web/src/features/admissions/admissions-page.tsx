"use client";
import { useSearchDraft } from "~/lib/use-search-draft";
import { useState, type ReactElement } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { useRouter } from "next/navigation";
import { parseAsString, useQueryStates } from "nuqs";
import { Plus } from "lucide-react";
import {
  Button,
  DataTable,
  DataTablePage,
  Input,
  TableFilters,
  TableFilterChips,
  type TableFilterField,
  type DataTableState,
} from "@lazuli/ui";
import { studentPaginationPolicy } from "@lazuli/validators";
import { trpc, type QueryResult } from "~/lib/trpc";
import { tablePaginationPropsFor, useUrlPagination } from "~/lib/pagination";
import { LeadCaptureDialog } from "./lead-capture-dialog";
import { admissionColumns } from "./admission-columns";
import type { CandidateRow } from "./labels";
import { leadFilterFields, leadFilterInput } from "./lead-filter-fields";

type CandidateQuery = QueryResult<RouterOutputs["admissions"]["list"]>;
export function AdmissionsPage(): ReactElement {
  const [params, setParams] = useQueryStates({
    interesse: parseAsString.withDefault("ALL"),
    busca: parseAsString.withDefault(""),
    situacao: parseAsString.withDefault("WAITING"),
  });
  const pagination = useUrlPagination(studentPaginationPolicy);
  const query = trpc.admissions.list.useQuery({
    ...leadFilterInput(params),
    search: params.busca,
    page: pagination.page,
    pageSize: pagination.pageSize,
  });
  const [creating, setCreating] = useState(false);
  const fields = leadFilterFields(params, (values) => {
    void setParams(values);
    pagination.setPage(1);
  });
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
            fields={fields}
            onClear={() => {
              void setParams({ situacao: "ALL", interesse: "ALL" });
              pagination.setPage(1);
            }}
            onCreate={() => setCreating(true)}
            onSearch={(busca) => {
              void setParams({ busca });
              pagination.setPage(1);
            }}
          />
        }
      >
        <div className="flex h-full min-h-0 flex-col gap-2">
          <TableFilterChips fields={fields} />
          <AdmissionsTable
            query={query}
            pagination={pagination}
            filtered={
              Boolean(params.busca) || params.interesse !== "ALL" || params.situacao !== "ALL"
            }
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
  fields,
  onClear,
}: {
  search: string;
  onSearch: (search: string) => void;
  onCreate: () => void;
  fields: TableFilterField[];
  onClear: () => void;
}): ReactElement {
  const [draft, setDraft] = useSearchDraft(search, onSearch);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-full sm:w-56">
        <Input
          name="candidate-search"
          aria-label="Buscar lead"
          placeholder="Nome, telefone ou e-mail"
          autoComplete="off"
          size="compact-responsive"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
      </div>
      <TableFilters fields={fields} onClearAll={onClear} />
      <Button size="compact-responsive" onClick={onCreate}>
        <Plus />
        Novo lead
      </Button>
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
        columns={admissionColumns}
        state={tableState(query, filtered)}
        updating={query.isFetching}
        onRowClick={(row) => router.push(`/interessados/${row.id}`)}
        onRetry={() => void query.refetch()}
        empty={{
          title: "O próximo aluno começa por aqui",
          description:
            "Cadastre o lead, agende uma experimental e avance para o cadastro do aluno.",
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
