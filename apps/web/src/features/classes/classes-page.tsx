"use client";
import { useState, type ReactElement, type ComponentProps } from "react";
import { parseAsInteger, parseAsString, useQueryStates } from "nuqs";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@lazuli/api";
import { Button, DataTablePage } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { classListQueryInput } from "./class-list-model";
import { classFilterFields } from "./class-filter-fields";
import { ClassFilters } from "./class-list-filters";
import { ClassListTable } from "./class-list-table";
import { ClassCreateDialog } from "./create-dialog";
import Link from "next/link";
import { CalendarDays } from "lucide-react";

type ClassQueries = inferRouterOutputs<AppRouter>["classes"];
export type InitialClassesData = {
  list?: { data: ClassQueries["list"]; updatedAt: number };
  options?: { data: ClassQueries["formOptions"]; updatedAt: number };
};

export function ClassesPage({
  initial,
}: {
  initial?: InitialClassesData | undefined;
}): ReactElement {
  const [params, setParams] = useQueryStates({
    busca: parseAsString.withDefault(""),
    tipo: parseAsString,
    formato: parseAsString,
    professor: parseAsString,
    estagio: parseAsString,
    semestre: parseAsString,
    estado: parseAsString,
    pagina: parseAsInteger.withDefault(1),
  });
  const [creating, setCreating] = useState(false);
  const defaultList =
    params.busca === "" &&
    params.pagina === 1 &&
    [
      params.tipo,
      params.formato,
      params.professor,
      params.estagio,
      params.semestre,
      params.estado,
    ].every((value) => value === null);
  const query = trpc.classes.list.useQuery(
    classListQueryInput(params),
    defaultList && initial?.list
      ? { initialData: initial.list.data, initialDataUpdatedAt: initial.list.updatedAt }
      : {},
  );
  const options = trpc.classes.formOptions.useQuery(
    undefined,
    initial?.options
      ? { initialData: initial.options.data, initialDataUpdatedAt: initial.options.updatedAt }
      : {},
  );
  const fields = classFilterFields({
    params,
    options: options.data,
    change: (value) => void setParams(value),
  });
  return (
    <>
      <DataTablePage
        title="Turmas"
        summary={query.data ? `${query.data.total} turmas` : undefined}
        controls={
          <ClassPageControls
            params={params}
            fields={fields}
            change={(value) => void setParams(value)}
            create={() => setCreating(true)}
          />
        }
      >
        <div className="flex h-full min-h-0 flex-col gap-2">
          <div className="min-h-0 flex-1">
            <ClassListTable
              data={query.data}
              isError={query.isError}
              refetch={() => void query.refetch()}
              params={params}
              setPage={(page) => void setParams({ pagina: page })}
            />
          </div>
        </div>
      </DataTablePage>
      <ClassCreateDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}

function ClassPageControls({
  params,
  fields,
  change,
  create,
}: ComponentProps<typeof ClassFilters>): ReactElement {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant="secondary"
        nativeButton={false}
        render={<Link href="/turmas/formacao" />}
      >
        <CalendarDays /> Formação de turmas
      </Button>
      <ClassFilters params={params} fields={fields} change={change} create={create} />
    </div>
  );
}
