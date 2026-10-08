"use client";
import type { ReactElement } from "react";
import { Plus } from "lucide-react";
import { Button, Input, TableFilters, type TableFilterField } from "@lazuli/ui";
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
        <Input
          aria-label="Buscar turmas"
          autoComplete="off"
          name="busca"
          placeholder="Turma ou professor"
          size="sm"
          value={params.busca}
          onChange={(event) => change({ busca: event.target.value, pagina: 1 })}
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
