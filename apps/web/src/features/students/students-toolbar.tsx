import { useEffect, useMemo, useState, type ReactElement } from "react";

import { Plus } from "lucide-react";

import { Button, InlineSkeleton, Input, Tabs, TabsList, TabsTab } from "@lazuli/ui";

import { debounce } from "~/lib/debounce";

import type { StudentsFilters } from "./logic";
import type { HeaderSummaryVm, StatusTabVm, StatusTabValue } from "./view-model";

const SEARCH_DEBOUNCE_MS = 300;

export function StudentsHeader({
  summary,
  onNewStudent,
}: {
  summary: HeaderSummaryVm | undefined;
  onNewStudent: () => void;
}): ReactElement {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-h2 font-semibold text-foreground">Alunos</h1>
        <p className="mt-1 text-caption text-muted-foreground">
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
        </p>
      </div>
      <Button onClick={onNewStudent} size="md">
        <Plus aria-hidden="true" className="size-4" />
        Novo aluno
      </Button>
    </div>
  );
}

/** Controlled input that only commits to the URL after the typing pauses. */
function SearchField({ filters }: { filters: StudentsFilters }): ReactElement {
  const [value, setValue] = useState(filters.busca);
  const commitSearch = useMemo(
    () => debounce((nextValue: string) => filters.setBusca(nextValue), SEARCH_DEBOUNCE_MS),
    [filters.setBusca],
  );

  useEffect(() => {
    // An external URL change (back button, shared link) resets pending input.
    setValue(filters.busca);
    commitSearch.cancel();
  }, [commitSearch, filters.busca]);

  useEffect(() => {
    return () => {
      commitSearch.cancel();
    };
  }, [commitSearch]);

  return (
    <Input
      aria-label="Buscar aluno"
      className="w-80"
      onChange={(event) => {
        const nextValue = event.target.value;
        setValue(nextValue);
        commitSearch(nextValue);
      }}
      placeholder="Buscar por nome, turma ou professor"
      type="search"
      value={value}
    />
  );
}

export function StudentsControls({
  filters,
  tabs,
}: {
  filters: StudentsFilters;
  tabs: StatusTabVm[];
}): ReactElement {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <SearchField filters={filters} />
      <Tabs
        onValueChange={(value) => {
          filters.setStatusTab(value as StatusTabValue);
        }}
        value={filters.statusTab}
      >
        <TabsList>
          {tabs.map((tab) => (
            <TabsTab key={tab.value} value={tab.value}>
              {tab.label}
              {tab.count === undefined ? (
                <InlineSkeleton className="w-5" />
              ) : (
                <span className="font-numeric text-micro tabular-nums text-muted-foreground">
                  {tab.count}
                </span>
              )}
            </TabsTab>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
