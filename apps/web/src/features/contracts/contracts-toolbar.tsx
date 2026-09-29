"use client";

import { useEffect, useMemo, useState, type ReactElement } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { Button, Input, TableFilters } from "@lazuli/ui";
import { debounce } from "~/lib/debounce";
import { CONTRACT_SEARCH_MAX_LENGTH, type ContractFilters } from "./contract-filters";
import { useContractFilterFields } from "./contract-filter-fields";

const SEARCH_DEBOUNCE_MS = 300;

function ContractSearch({ filters }: { filters: ContractFilters }): ReactElement {
  const [value, setValue] = useState(filters.search);
  const location = useSearchParams().toString();
  const commit = useMemo(
    () =>
      debounce(
        (search: string) => filters.setFilters({ busca: search || null }),
        SEARCH_DEBOUNCE_MS,
      ),
    [filters.setFilters],
  );
  useEffect(() => {
    setValue(filters.search);
    commit.cancel();
  }, [filters.search, location, commit]);
  useEffect(() => () => commit.cancel(), [commit]);
  return (
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
        maxLength={CONTRACT_SEARCH_MAX_LENGTH}
        size="sm"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          commit(event.target.value);
        }}
      />
    </div>
  );
}

export function ContractsToolbar({
  filters,
  onNew,
}: {
  filters: ContractFilters;
  onNew: () => void;
}): ReactElement {
  const fields = useContractFilterFields(filters);
  return (
    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
      <ContractSearch filters={filters} />
      <TableFilters
        fields={fields}
        onClearAll={() =>
          filters.setFilters({
            pagador: null,
            beneficiario: null,
            vigenciaDe: null,
            vigenciaAte: null,
            situacao: null,
          })
        }
      />
      <Button onClick={onNew} size="sm">
        <Plus aria-hidden="true" className="size-4" />
        Novo contrato
      </Button>
    </div>
  );
}
