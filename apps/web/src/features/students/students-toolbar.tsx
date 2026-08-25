import { useEffect, useState, type ReactElement } from "react";

import { Plus } from "lucide-react";

import { Button, Input, Tabs, TabsList, TabsTab } from "@lazuli/ui";

import type { StudentsFilters } from "./logic";
import type { StatusTabVm, StatusTabValue } from "./view-model";

const SEARCH_DEBOUNCE_MS = 300;

export function StudentsHeader({
  summary,
  onNewStudent,
}: {
  summary: string | null;
  onNewStudent: () => void;
}): ReactElement {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-h2 font-semibold text-foreground">Alunos</h1>
        {summary === null ? null : (
          <p className="mt-1 text-caption text-muted-foreground">{summary}</p>
        )}
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
  const [committed, setCommitted] = useState(filters.busca);

  // An external URL change (back button, shared link) resets the field.
  if (filters.busca !== committed) {
    setCommitted(filters.busca);
    setValue(filters.busca);
  }

  useEffect(() => {
    if (value === filters.busca) {
      return;
    }

    const timer = setTimeout(() => {
      setCommitted(value);
      filters.setBusca(value);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [value, filters]);

  return (
    <Input
      aria-label="Buscar aluno"
      className="w-80"
      onChange={(event) => {
        setValue(event.target.value);
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
              <span className="font-numeric text-micro tabular-nums text-muted-foreground">
                {tab.count}
              </span>
            </TabsTab>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
