"use client";

import { useRef, useState, type ReactElement } from "react";

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

import { trpc } from "~/lib/trpc";

import {
  contractInputFromFields,
  contractPreview,
  emptyContractFields,
  type ContractFields,
} from "./contract-form-model";
import { ContractFormFields } from "./contract-form-fields";

const FORM_ID = "new-contract-form";

export function NewContractDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}): ReactElement {
  const [fields, setFields] = useState<ContractFields>(emptyContractFields);
  const [errors, setErrors] = useState<Partial<Record<keyof ContractFields, string>>>({});
  const [submissionError, setSubmissionError] = useState("");
  const commandId = useRef(crypto.randomUUID());
  const popup = useRef<HTMLDivElement>(null);
  const offer = trpc.finance.readContractOffer.useQuery(undefined, { enabled: open });
  const create = trpc.finance.createMonthlyContract.useMutation();
  const preview = contractPreview(fields, offer.data);
  const change = (name: keyof ContractFields, value: string): void => {
    setFields((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setSubmissionError("");
  };
  const close = (next: boolean): void => {
    if (!next && create.isPending) return;
    if (!next) {
      setFields(emptyContractFields);
      setErrors({});
      setSubmissionError("");
      commandId.current = crypto.randomUUID();
    }
    onOpenChange(next);
  };
  const submit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const parsed = contractInputFromFields(fields, commandId.current);
    if (!parsed.success || !preview) {
      const nextErrors: Partial<Record<keyof ContractFields, string>> = {};
      for (const issue of parsed.success ? [] : parsed.error.issues) {
        const name = issue.path[0] as keyof ContractFields | "monthlyAmountCents";
        if (name === "monthlyAmountCents")
          nextErrors.monthlyAmount = "Informe uma mensalidade válida.";
        else if (
          name === "studentId" ||
          name === "payerId" ||
          name === "agreedOn" ||
          name === "startsOn" ||
          name === "durationMonths" ||
          name === "firstDueDate" ||
          name === "punctualityDiscountPct"
        )
          nextErrors[name] = "Confira este campo.";
      }
      if (parsed.success && !preview)
        nextErrors.monthlyAmount = "A mensalidade em dia deve respeitar o piso autorizado.";
      setErrors(nextErrors);
      requestAnimationFrame(() =>
        popup.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
      return;
    }
    try {
      await create.mutateAsync(parsed.data);
      onCreated();
      close(false);
    } catch (error) {
      setSubmissionError(
        error instanceof Error ? error.message : "Não foi possível criar o contrato.",
      );
    }
  };
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogContent
          className="md:max-w-2xl"
          initialFocus={() =>
            popup.current?.querySelector<HTMLInputElement>('input[name="studentSearch"]') ?? true
          }
          ref={popup}
        >
          <DialogHeader>
            <DialogTitle>Novo contrato mensal</DialogTitle>
            <DialogDescription>
              Defina as partes, a vigência e a primeira cobrança.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="mt-4 space-y-4">
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
            <form
              id={FORM_ID}
              noValidate
              onSubmit={(event) => void submit(event)}
              className="space-y-5"
            >
              <ContractFormFields
                fields={fields}
                errors={errors}
                offer={offer.data}
                preview={preview}
                change={change}
              />
            </form>
          </DialogBody>
          {submissionError && (
            <p role="alert" className="mt-3 text-caption text-destructive">
              {submissionError}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => close(false)}
              disabled={create.isPending}
            >
              Cancelar
            </Button>
            <Button form={FORM_ID} type="submit" disabled={create.isPending || !offer.data}>
              {create.isPending ? "Criando…" : "Criar contrato"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
