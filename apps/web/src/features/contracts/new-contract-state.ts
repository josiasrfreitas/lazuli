"use client";

import { useRef, useState, type FormEvent, type RefObject } from "react";
import { trpc } from "~/lib/trpc";
import type { FormProps } from "./contract-form-fields";
import {
  contractInputFromFields,
  contractPreview,
  emptyContractFields,
  type ContractFields,
} from "./contract-form-model";

type Errors = Partial<Record<keyof ContractFields, string>>;
type ParsedInput = ReturnType<typeof contractInputFromFields>;
const FORM_KEYS = new Set<keyof ContractFields>([
  "studentId",
  "payerId",
  "agreedOn",
  "startsOn",
  "durationMonths",
  "firstDueDate",
  "punctualityDiscountPct",
]);

export function fieldErrors(parsed: ParsedInput, hasPreview: boolean): Errors {
  const errors: Errors = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      if (issue.path[0] === "newPayer") {
        const payerKeys: Record<string, keyof ContractFields> = {
          name: "payerName",
          documentType: "payerDocumentType",
          documentNumber: "payerDocumentNumber",
          phone: "payerPhone",
          email: "payerEmail",
        };
        errors[payerKeys[String(issue.path[1])] ?? "payerName"] = issue.message;
        continue;
      }
      const name = issue.path[0] as keyof ContractFields | "monthlyAmountCents";
      if (name === "monthlyAmountCents") errors.monthlyAmount = "Informe uma mensalidade válida.";
      else if (FORM_KEYS.has(name)) errors[name] = "Confira este campo.";
    }
  }
  if (parsed.success && !hasPreview)
    errors.monthlyAmount = "A mensalidade em dia deve respeitar o piso autorizado.";
  return errors;
}

export type ContractFormState = {
  fields: ContractFields;
  errors: Errors;
  submissionError: string;
  commandId: RefObject<string>;
  popup: RefObject<HTMLDivElement | null>;
  change: (name: keyof ContractFields, value: string) => void;
  reset: () => void;
  setErrors: (errors: Errors) => void;
  setSubmissionError: (message: string) => void;
};

export function useContractFormState(): ContractFormState {
  const [fields, setFields] = useState<ContractFields>(emptyContractFields);
  const [errors, setErrors] = useState<Errors>({});
  const [submissionError, setSubmissionError] = useState("");
  const commandId = useRef(crypto.randomUUID());
  const popup = useRef<HTMLDivElement>(null);
  const change = (name: keyof ContractFields, value: string): void => {
    setFields((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setSubmissionError("");
  };
  const reset = (): void => {
    setFields(emptyContractFields);
    setErrors({});
    setSubmissionError("");
    commandId.current = crypto.randomUUID();
  };
  return {
    fields,
    errors,
    submissionError,
    commandId,
    popup,
    change,
    reset,
    setErrors,
    setSubmissionError,
  };
}

export type ContractOperation = {
  offer: {
    data: FormProps["offer"];
    isPending: boolean;
    isError: boolean;
    refetch: () => void;
  };
  preview: ReturnType<typeof contractPreview>;
  pending: boolean;
  close: (next: boolean) => void;
  submit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
};

export function useContractOperation(input: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  state: ContractFormState;
}): ContractOperation {
  const { state } = input;
  const offer = trpc.finance.readContractOffer.useQuery(undefined, { enabled: input.open });
  const create = trpc.finance.createMonthlyContract.useMutation();
  const submitting = useRef(false);
  const utils = trpc.useUtils();
  const preview = contractPreview(state.fields, offer.data);
  const close = (next: boolean): void => {
    if (!next && submitting.current) return;
    if (!next) state.reset();
    input.onOpenChange(next);
  };
  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (submitting.current) return;
    const parsed = contractInputFromFields(state.fields, state.commandId.current);
    if (!parsed.success || !preview) {
      state.setErrors(fieldErrors(parsed, Boolean(preview)));
      requestAnimationFrame(() => {
        const invalid = state.popup.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
        const control = invalid?.querySelector<HTMLElement>("button, input") ?? invalid;
        control?.focus();
      });
      return;
    }
    try {
      submitting.current = true;
      await create.mutateAsync(parsed.data);
      void utils.finance.searchContractParties.invalidate();
      input.onCreated();
      state.reset();
      input.onOpenChange(false);
    } catch (error) {
      state.setSubmissionError(
        error instanceof Error ? error.message : "Não foi possível criar o contrato.",
      );
    } finally {
      submitting.current = false;
    }
  };
  return { offer, preview, pending: create.isPending, close, submit };
}
