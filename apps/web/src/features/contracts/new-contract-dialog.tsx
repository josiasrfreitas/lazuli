"use client";

import type { ReactElement } from "react";
import {
  Button,
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
import { ContractFormFields } from "./contract-form-fields";
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

function DialogForm({
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
          />
        </fieldset>
      </form>
    </DialogBody>
  );
}

function DialogActions({ operation }: { operation: ContractOperation }): ReactElement {
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

export function NewContractDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}): ReactElement {
  const state = useContractFormState();
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
          <DialogForm state={state} operation={operation} />
          {state.submissionError && (
            <p role="alert" className="mt-3 text-caption text-destructive">
              {state.submissionError}
            </p>
          )}
          <DialogActions operation={operation} />
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
