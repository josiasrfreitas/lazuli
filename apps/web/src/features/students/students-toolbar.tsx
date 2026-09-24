import { useEffect, useMemo, useState, type ReactElement } from "react";

import { Plus, Search } from "lucide-react";

import { Button, InlineSkeleton, Input, TableFilters, type TableFilterField } from "@lazuli/ui";

import { debounce } from "~/lib/debounce";

import type { StudentsFilters } from "./logic";
import type { HeaderSummaryVm } from "./view-model";

const SEARCH_DEBOUNCE_MS = 300;

export function StudentsSummary({
  summary,
}: {
  summary: HeaderSummaryVm | undefined;
}): ReactElement {
  return (
    <>
      {summary === undefined ? (
        <InlineSkeleton />
      ) : (
        <span className="font-numeric tabular-nums">{summary.totalStudents}</span>
      )}{" "}
      {summary?.totalStudents === 1 ? "aluno" : "alunos"} ·{" "}
      {summary === undefined ? (
        <InlineSkeleton />
      ) : (
        <span className="font-numeric tabular-nums">{summary.activeClasses}</span>
      )}{" "}
      {summary?.activeClasses === 1 ? "turma ativa" : "turmas ativas"}
    </>
  );
}

/** Controlled input that only commits to the URL after the typing pauses. */
function SearchField({ filters }: { filters: StudentsFilters }): ReactElement {
  const [value, setValue] = useState(filters.search);
  const commitSearch = useMemo(
    () => debounce((nextValue: string) => filters.setSearch(nextValue), SEARCH_DEBOUNCE_MS),
    [filters.setSearch],
  );

  useEffect(() => {
    // An external URL change (back button, shared link) resets pending input.
    setValue(filters.search);
    commitSearch.cancel();
  }, [commitSearch, filters.search]);

  useEffect(() => {
    return () => {
      commitSearch.cancel();
    };
  }, [commitSearch]);

  return (
    <div className="relative w-full sm:w-80">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        aria-label="Buscar aluno"
        className="pl-8"
        onChange={(event) => {
          const nextValue = event.target.value;
          setValue(nextValue);
          commitSearch(nextValue);
        }}
        placeholder="Buscar por nome, turma ou professor"
        size="sm"
        type="search"
        value={value}
      />
    </div>
  );
}

export function StudentsControls({
  filters,
  fields,
  onNewStudent,
}: {
  filters: StudentsFilters;
  fields: TableFilterField[];
  onNewStudent: () => void;
}): ReactElement {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <SearchField filters={filters} />
      <TableFilters
        fields={fields}
        onClearAll={() =>
          filters.setFilters({
            situations: null,
            classIds: null,
            teacherIds: null,
            registeredFrom: null,
            registeredTo: null,
          })
        }
      />
      <Button onClick={onNewStudent} size="sm">
        <Plus aria-hidden="true" className="size-4" />
        Novo aluno
      </Button>
    </div>
  );
}
