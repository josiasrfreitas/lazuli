"use client";

import { useState, type ReactElement } from "react";
import { DataTablePage } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { useContractFilters } from "./contract-filters";
import { ContractsTable } from "./contracts-table";
import { ContractsToolbar } from "./contracts-toolbar";
import { NewContractDialog } from "./new-contract-dialog";

export function ContractsPage(): ReactElement {
  const filters = useContractFilters();
  const [creating, setCreating] = useState(false);
  const utils = trpc.useUtils();
  return (
    <>
      <DataTablePage
        title="Contratos"
        summary="Acordos mensais"
        controls={<ContractsToolbar filters={filters} onNew={() => setCreating(true)} />}
      >
        <ContractsTable filters={filters} />
      </DataTablePage>
      <NewContractDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={() => void utils.finance.listContracts.invalidate()}
      />
    </>
  );
}
