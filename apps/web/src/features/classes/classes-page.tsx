"use client";
import { useState, type ReactElement } from "react";
import { parseAsInteger, parseAsString, useQueryStates } from "nuqs";
import { DataTablePage, TableFilterChips } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { classListQueryInput } from "./class-list-model";
import { classFilterFields } from "./class-filter-fields";
import { ClassFilters } from "./class-list-filters";
import { ClassListTable } from "./class-list-table";
import { ClassCreateDialog } from "./create-dialog";
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
  const query = trpc.classes.list.useQuery(classListQueryInput(params));
  const options = trpc.classes.formOptions.useQuery();
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
          <ClassFilters
            params={params}
            fields={fields}
            change={(value) => void setParams(value)}
            create={() => setCreating(true)}
          />
        }
      >
        <div className="flex h-full min-h-0 flex-col gap-2">
          <TableFilterChips fields={fields} />
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
