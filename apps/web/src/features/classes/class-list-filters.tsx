"use client";
import { TableSearch } from "~/components/table-search";
import type { ReactElement } from "react";
import { Plus } from "lucide-react";
import { Button, TableFilters, type TableFilterField } from "@lazuli/ui";
import { CLEAR_CLASS_FILTERS, type ClassListParams } from "./class-list-model";

export function ClassFilters({
  params,
  fields,
  change,
  create,
}: {
  params: ClassListParams;
  fields: TableFilterField[];
  change: (value: Partial<ClassListParams>) => void;
  create: () => void;
}): ReactElement {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-full sm:w-64">
        <TableSearch
          label="Buscar turmas"
          name="busca"
          placeholder="Turma ou professor"
          value={params.busca}
          onCommit={(busca) => change({ busca, pagina: 1 })}
        />
      </div>
      <TableFilters fields={fields} onClearAll={() => change(CLEAR_CLASS_FILTERS)} />
      <Button size="sm" onClick={create}>
        <Plus />
        Nova turma
      </Button>
    </div>
  );
}
