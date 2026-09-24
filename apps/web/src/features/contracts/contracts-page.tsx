"use client";

import { useEffect, useMemo, useState, type ReactElement } from "react";
import { DataTablePage } from "@lazuli/ui";
import { debounce } from "~/lib/debounce";
import { trpc } from "~/lib/trpc";
import { ContractsTable } from "./contracts-table";
import { ContractsToolbar } from "./contracts-toolbar";
import { NewContractDialog } from "./new-contract-dialog";

const SEARCH_DEBOUNCE_MS = 300;

export function ContractsPage(): ReactElement {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const commitSearch = useMemo(
    () =>
      debounce((value: string) => {
        setQuery(value);
        setPage(1);
      }, SEARCH_DEBOUNCE_MS),
    [],
  );
  useEffect(() => () => commitSearch.cancel(), [commitSearch]);
  const utils = trpc.useUtils();
  return (
    <>
      <DataTablePage
        className="p-4 sm:p-6"
        header={
          <div>
            <h1 className="font-display text-h2 font-semibold">Contratos</h1>
            <p className="text-caption text-muted-foreground">
              Acordos mensais com aluno e pagador existentes
            </p>
          </div>
        }
        controls={
          <ContractsToolbar
            search={search}
            onSearch={(value) => {
              setSearch(value);
              commitSearch(value);
            }}
            onNew={() => setCreating(true)}
          />
        }
      >
        <ContractsTable page={page} query={query} onPageChange={setPage} />
      </DataTablePage>
      <NewContractDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={() => void utils.finance.listContracts.invalidate()}
      />
    </>
  );
}
