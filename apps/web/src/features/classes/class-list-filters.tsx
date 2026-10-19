"use client";
import { useSearchDraft } from "~/lib/use-search-draft";
import type { ReactElement } from "react";
import { Plus, Search } from "lucide-react";
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
  const [search, setSearch] = useSearchDraft(params.busca, (busca) => change({ busca, pagina: 1 }));
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-64">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-icon"
        />
        <Input
          className="pl-9"
          aria-label="Buscar turmas"
          autoComplete="off"
          name="busca"
          placeholder="Turma ou professor"
          size="sm"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
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
