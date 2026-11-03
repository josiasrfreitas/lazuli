"use client";

import { useState, type ReactElement } from "react";
import {
  DataTablePage,
  Dialog,
  DialogBackdrop,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogPortal,
  DialogTitle,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { useContractFilters } from "./contract-filters";
import { ContractSetup } from "./contract-setup";
import { ContractsTable } from "./contracts-table";
import { ContractsToolbar } from "./contracts-toolbar";
import { emptyContractFields, type ContractFields } from "./contract-form-model";
import { useContractFormState, useContractOperation } from "./new-contract-state";

export function NewContractDialog({
  open,
  onOpenChange,
  onCreated,
  initialFields,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  initialFields?: Partial<ContractFields>;
}): ReactElement {
  const state = useContractFormState(open, { ...emptyContractFields, ...initialFields });
  const operation = useContractOperation({ open, onOpenChange, onCreated, state });
  return (
    <Dialog open={open} onOpenChange={operation.close}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent
          className="md:max-w-6xl h-[min(48rem,calc(100dvh-4rem))]"
          initialFocus={() =>
            state.popup.current?.querySelector<HTMLInputElement>('input[name="studentSearch"]') ??
            true
          }
        >
          <DialogHeader>
            <DialogTitle>Novo contrato</DialogTitle>
            <DialogDescription>
              Combine as mensalidades e a aquisição de material.
            </DialogDescription>
          </DialogHeader>
          <ContractSetup
            key={state.commandId.current}
            state={state}
            offer={operation.offer}
            pending={operation.pending}
            completeLabel="Criar contrato"
            onComplete={operation.submit}
            onBack={() => operation.close(false)}
          />
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

export function ContractsPage(): ReactElement {
  const filters = useContractFilters();
  const [creating, setCreating] = useState(false);
  const utils = trpc.useUtils();
  return (
    <>
      <DataTablePage
        title="Contratos"
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
