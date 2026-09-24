"use client";

import type { ReactElement } from "react";
import { Plus, Search } from "lucide-react";
import { Button, Input } from "@lazuli/ui";

const SEARCH_MAX_LENGTH = 80;

export function ContractsToolbar({
  search,
  onSearch,
  onNew,
}: {
  search: string;
  onSearch: (value: string) => void;
  onNew: () => void;
}): ReactElement {
  return (
    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
      <div className="relative min-w-48 flex-1 sm:w-64 sm:flex-none">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          aria-label="Buscar contrato por aluno ou pagador"
          className="pl-8"
          type="search"
          placeholder="Buscar aluno ou pagador"
          maxLength={SEARCH_MAX_LENGTH}
          size="sm"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
        />
      </div>
      <Button onClick={onNew} size="sm">
        <Plus aria-hidden="true" className="size-4" />
        Novo contrato
      </Button>
    </div>
  );
}
