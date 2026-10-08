"use client";
import { useState, type ReactElement } from "react";
import { parseAsInteger, parseAsString, useQueryStates } from "nuqs";
import { DataTablePage } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import type { ClassListParams as Params } from "./class-list-model";
import { ClassFilters } from "./class-list-filters";
import { ClassListTable } from "./class-list-table";
import { ClassCreateDialog } from "./create-dialog";
function listQueryInput(params: Params): {
  search: string;
  page: number;
  pageSize: number;
  scheduleType?: "REGULAR" | "PERSONALIZED";
  format?: "IN_PERSON" | "ONLINE";
  teacherId?: string;
  semesterId?: string;
  status?: "ACTIVE" | "ARCHIVED";
} {
  return {
    search: params.busca,
    page: params.pagina,
    pageSize: 20,
    ...(params.tipo === "REGULAR" || params.tipo === "PERSONALIZED"
      ? { scheduleType: params.tipo }
      : {}),
    ...(params.formato === "IN_PERSON" || params.formato === "ONLINE"
      ? { format: params.formato }
      : {}),
    ...(params.professor ? { teacherId: params.professor } : {}),
    ...(params.semestre ? { semesterId: params.semestre } : {}),
    ...(params.estado === "ACTIVE" || params.estado === "ARCHIVED"
      ? { status: params.estado }
      : {}),
  };
}
export function ClassesPage(): ReactElement {
  const [params, setParams] = useQueryStates({
    busca: parseAsString.withDefault(""),
    tipo: parseAsString,
    formato: parseAsString,
    professor: parseAsString,
    semestre: parseAsString,
    estado: parseAsString,
    pagina: parseAsInteger.withDefault(1),
  });
  const [creating, setCreating] = useState(false);
  const query = trpc.classes.list.useQuery(listQueryInput(params));
  return (
    <>
      <DataTablePage
        title="Turmas"
        summary={query.data ? `${query.data.total} turmas` : undefined}
        controls={
          <ClassFilters
            params={params}
            change={(value) => void setParams(value)}
            create={() => setCreating(true)}
          />
        }
      >
        <ClassListTable
          data={query.data}
          isError={query.isError}
          refetch={() => void query.refetch()}
          params={params}
          setPage={(page) => void setParams({ pagina: page })}
        />
      </DataTablePage>
      <ClassCreateDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}
