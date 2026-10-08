"use client";

import { useState, type ReactElement } from "react";
import {
  Button,
  DataTablePage,
  Dialog,
  DialogBackdrop,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPortal,
  DialogTitle,
} from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { useContractFilters } from "./contract-filters";
import { ContractFormFields } from "./contract-form-fields";
import { ContractsTable } from "./contracts-table";
import { ContractsToolbar } from "./contracts-toolbar";
import {
  useContractFormState,
  useContractOperation,
  type ContractFormState,
  type ContractOperation,
} from "./new-contract-state";

const FORM_ID = "new-contract-form";

function OfferMessage({ operation }: { operation: ContractOperation }): ReactElement {
  const { offer } = operation;
  return (
    <>
      {offer.isPending && <p role="status">Carregando condições…</p>}
      {offer.isError && (
        <p role="alert">
          Não foi possível carregar as condições.{" "}
          <Button onClick={() => void offer.refetch()} type="button" variant="link">
            Tentar novamente
          </Button>
        </p>
      )}
      {offer.data === null && (
        <p role="alert">Configure os ajustes financeiros antes de criar contratos.</p>
      )}
    </>
  );
}

function ContractDialogForm({
  state,
  operation,
}: {
  state: ContractFormState;
  operation: ContractOperation;
}): ReactElement {
  return (
    <DialogBody className="mt-4 space-y-4">
      <OfferMessage operation={operation} />
      <form
        id={FORM_ID}
        noValidate
        onSubmit={(event) => void operation.submit(event)}
        className="space-y-5"
      >
        <fieldset disabled={operation.pending} className="space-y-5">
          <ContractFormFields
            fields={state.fields}
            errors={state.errors}
            offer={operation.offer.data}
            preview={operation.preview}
            change={state.change}
            onMonthlyAmountBlur={operation.validateMonthlyAmount}
          />
        </fieldset>
      </form>
    </DialogBody>
  );
}

function ContractDialogActions({ operation }: { operation: ContractOperation }): ReactElement {
  return (
    <DialogFooter>
      <Button
        type="button"
        variant="secondary"
        onClick={() => operation.close(false)}
        disabled={operation.pending}
      >
        Cancelar
      </Button>
      <Button form={FORM_ID} type="submit" disabled={operation.pending || !operation.offer.data}>
        {operation.pending ? "Criando…" : "Criar contrato"}
      </Button>
    </DialogFooter>
  );
}

function NewContractDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}): ReactElement {
  const state = useContractFormState(open);
  const operation = useContractOperation({ open, onOpenChange, onCreated, state });
  return (
    <Dialog open={open} onOpenChange={operation.close}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent
          className="md:max-w-2xl"
          initialFocus={() =>
            state.popup.current?.querySelector<HTMLInputElement>('input[name="studentSearch"]') ??
            true
          }
          ref={state.popup}
        >
          <DialogHeader>
            <DialogTitle>Novo contrato mensal</DialogTitle>
            <DialogDescription>
              Defina as partes, a vigência e a primeira cobrança.
            </DialogDescription>
          </DialogHeader>
          <ContractDialogForm state={state} operation={operation} />
          {state.submissionError && (
            <p role="alert" className="mt-3 text-caption text-destructive">
              {state.submissionError}
            </p>
          )}
          <ContractDialogActions operation={operation} />
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
