"use client";
import type { ReactElement } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type DataTableState } from "@lazuli/ui";
import type { RouterOutputs } from "@lazuli/api";
import { classColumns } from "./class-columns";
import { classListReturnUrl, type ClassListParams as Params } from "./class-list-model";
type List = RouterOutputs["classes"]["list"];
type Row = List["rows"][number];
function tableState(
  data: List | undefined,
  flags: { error: boolean; filtered: boolean },
): DataTableState<Row> {
  if (flags.error) return { kind: "error" };
  if (!data) return { kind: "loading" };
  if (data.rows.length === 0) return { kind: flags.filtered ? "noResults" : "empty" };
  return { kind: "data", rows: data.rows };
}
export function ClassListTable({
  data,
  isError,
  refetch,
  params,
  setPage,
}: {
  data: List | undefined;
  isError: boolean;
  refetch: () => void;
  params: Params;
  setPage: (page: number) => void;
}): ReactElement {
  const router = useRouter();
  const back = encodeURIComponent(classListReturnUrl(params));
  return (
    <DataTable
      label="Turmas"
      onRowClick={(row) => router.push(`/turmas/${row.id}?voltar=${back}`)}
      columns={classColumns(params)}
      state={tableState(data, {
        error: isError,
        filtered: Boolean(
          params.busca ||
          params.tipo ||
          params.formato ||
          params.professor ||
          params.semestre ||
          params.estado,
        ),
      })}
      onRetry={refetch}
      errorTitle="Não foi possível carregar as turmas"
      empty={{
        title: "Nenhuma turma cadastrada",
        description: "Crie a primeira turma para começar.",
      }}
      pagination={{
        page: params.pagina,
        pageSize: 20,
        ...(data ? { pageCount: data.pageCount, totalItems: data.total } : { loading: true }),
        onPageChange: setPage,
        itemLabel: { singular: "turma", plural: "turmas" },
      }}
    />
  );
}
