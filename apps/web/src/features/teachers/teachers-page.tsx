"use client";
import type { RouterOutputs } from "@lazuli/api";
import { type UrlPagination, useUrlPagination } from "~/lib/pagination";
import { type Dispatch, type SetStateAction, type ReactElement, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import {
  Button,
  DataTablePage,
  Input,
  TableFilters,
  TableFilterChips,
  type TableFilterField,
} from "@lazuli/ui";
import { studentPaginationPolicy } from "@lazuli/validators";
import { trpc, type QueryResult } from "~/lib/trpc";
import { TeacherDialog } from "./teacher-dialog";
import { TeacherTable } from "./teacher-table";

const activity = ["all", "active", "scheduled", "departed"] as const;
const access = ["all", "enabled", "disabled"] as const;
export function TeachersPage(): ReactElement {
  const filters = useTeacherFilters();
  const { params, setParams, pagination, fields, filtered } = filters;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [creating, setCreating] = useState(false);
  const query = useTeacherListQuery(filters);
  const href = (id: string): string =>
    `/professores/${id}?voltar=${encodeURIComponent(`/professores?${searchParams.toString()}`)}`;

  return (
    <>
      <DataTablePage
        title="Professores"
        summary={query.data ? `${query.data.total} professores` : undefined}
        controls={
          <TeacherListControls
            params={params}
            setParams={setParams}
            pagination={pagination}
            fields={fields}
            setCreating={setCreating}
          />
        }
      >
        <TeacherListResults
          fields={fields}
          queryData={query.data}
          queryIsError={query.isError}
          queryIsFetching={query.isFetching}
          filtered={filtered}
          pagination={pagination}
          href={href}
          router={router}
          queryRefetch={() => void query.refetch()}
        />
      </DataTablePage>
      {creating && <TeacherDialog onClose={() => setCreating(false)} />}
    </>
  );
}

type TeacherListControlsProps = {
  params: {
    busca: string;
    atuacao: "all" | "active" | "scheduled" | "departed";
    acesso: "all" | "enabled" | "disabled";
  };
  setParams: (
    value: Partial<{
      busca: string;
      atuacao: "all" | "active" | "scheduled" | "departed";
      acesso: "all" | "enabled" | "disabled";
    }>,
  ) => Promise<URLSearchParams>;
  pagination: UrlPagination;
  fields: TableFilterField[];
  setCreating: Dispatch<SetStateAction<boolean>>;
};
function TeacherListControls(props: TeacherListControlsProps): ReactElement {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-full sm:w-56">
        <Input
          name="teacher-search"
          aria-label="Buscar professor"
          placeholder="Buscar por nome"
          autoComplete="off"
          size="compact-responsive"
          value={props.params.busca}
          onChange={(event) => {
            void props.setParams({ busca: event.target.value });
            props.pagination.setPage(1);
          }}
        />
      </div>
      <TableFilters
        fields={props.fields}
        onClearAll={() => {
          void props.setParams({ atuacao: "all", acesso: "all" });
          props.pagination.setPage(1);
        }}
      />
      <Button size="compact-responsive" onClick={() => props.setCreating(true)}>
        Novo professor
      </Button>
    </div>
  );
}

type TeacherFilterContext = Pick<TeacherListControlsProps, "params" | "setParams" | "pagination">;
function activityField({ params, setParams, pagination }: TeacherFilterContext): TableFilterField {
  return {
    id: "activity",
    kind: "options",
    label: "Atuação",
    promoted: true,
    options: [
      { id: "active", label: "Ativa" },
      { id: "scheduled", label: "Saída programada" },
      { id: "departed", label: "Inativa" },
    ],
    selected: params.atuacao === "all" ? [] : [params.atuacao],
    onClear: () => {
      void setParams({ atuacao: "all" });
      pagination.setPage(1);
    },
    onChange: (values) => {
      const last = values.at(-1);
      void setParams({
        atuacao: last === "active" || last === "scheduled" || last === "departed" ? last : "all",
      });
      pagination.setPage(1);
    },
  };
}
function accessField({ params, setParams, pagination }: TeacherFilterContext): TableFilterField {
  return {
    id: "access",
    kind: "options",
    label: "Acesso",
    promoted: true,
    options: [
      { id: "enabled", label: "Habilitado" },
      { id: "disabled", label: "Não habilitado" },
    ],
    selected: params.acesso === "all" ? [] : [params.acesso],
    onClear: () => {
      void setParams({ acesso: "all" });
      pagination.setPage(1);
    },
    onChange: (values) => {
      const last = values.at(-1);
      void setParams({ acesso: last === "enabled" || last === "disabled" ? last : "all" });
      pagination.setPage(1);
    },
  };
}

type TeacherListResultsProps = {
  fields: TableFilterField[];
  queryData: RouterOutputs["teachers"]["list"] | undefined;
  queryIsError: boolean;
  queryIsFetching: boolean;
  filtered: boolean;
  pagination: UrlPagination;
  href: (id: string) => string;
  router: { push: (href: string) => void };
  queryRefetch: () => void;
};
function TeacherListResults(props: TeacherListResultsProps): ReactElement {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <TableFilterChips fields={props.fields} />
      <div className="min-h-0 flex-1">
        <TeacherTable
          data={props.queryData}
          isError={props.queryIsError}
          isFetching={props.queryIsFetching}
          filtered={props.filtered}
          pagination={props.pagination}
          href={props.href}
          onOpen={(id) => props.router.push(props.href(id))}
          onRetry={() => void props.queryRefetch()}
        />
      </div>
    </div>
  );
}

type TeacherFilters = Pick<
  TeacherListControlsProps,
  "params" | "setParams" | "pagination" | "fields"
> & { filtered: boolean };
function useTeacherFilters(): TeacherFilters {
  const [params, setParams] = useQueryStates({
    busca: parseAsString.withDefault(""),
    atuacao: parseAsStringLiteral(activity).withDefault("all"),
    acesso: parseAsStringLiteral(access).withDefault("all"),
  });
  const pagination = useUrlPagination(studentPaginationPolicy);
  const fields = [
    activityField({ params, setParams, pagination }),
    accessField({ params, setParams, pagination }),
  ];
  const filtered = Boolean(params.busca || params.atuacao !== "all" || params.acesso !== "all");
  return { params, setParams, pagination, fields, filtered };
}
function useTeacherListQuery({
  params,
  pagination,
}: TeacherFilters): QueryResult<RouterOutputs["teachers"]["list"]> {
  const query = trpc.teachers.list.useQuery({
    search: params.busca,
    active: params.atuacao,
    access: params.acesso,
    page: pagination.page,
    pageSize: pagination.pageSize,
  });
  return query;
}
