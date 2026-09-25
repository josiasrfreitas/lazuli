"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type RefObject,
  type SetStateAction,
} from "react";
import { addCalendarMonths } from "@lazuli/domain";
import { monthlyAmountError } from "./contract-price";
import { trpc } from "~/lib/trpc";
import { toDateOnlySaoPaulo } from "~/lib/format";
import { parseDateBR } from "~/lib/masks";
import type { FormProps } from "./contract-form-fields";
import {
  contractInputFromFields,
  contractPreview,
  emptyContractFields,
  suggestMonthlyAmount,
  type ContractFields,
} from "./contract-form-model";

type Errors = Partial<Record<keyof ContractFields, string>>;
type ParsedInput = ReturnType<typeof contractInputFromFields>;
const DEFAULT_CONTRACT_MONTHS = 12;
const FORM_KEYS = new Set<keyof ContractFields>([
  "studentId",
  "payerId",
  "agreedOn",
  "endsOn",
  "firstDueDate",
]);
type ContractIssue = { path: (string | number)[]; message: string };
const STUDENT_KEYS: Record<string, keyof ContractFields> = {
  fullName: "studentDraftName",
  documentType: "studentDocumentNumber",
  documentNumber: "studentDocumentNumber",
  phone: "studentPhone",
  email: "studentEmail",
};
const GUARDIAN_KEYS: Record<string, keyof ContractFields> = {
  fullName: "studentGuardianName",
  phone: "studentGuardianPhone",
  email: "studentGuardianEmail",
};
const PAYER_KEYS: Record<string, keyof ContractFields> = {
  name: "payerName",
  documentType: "payerDocumentNumber",
  documentNumber: "payerDocumentNumber",
  phone: "payerPhone",
  email: "payerEmail",
};

function assignIssue(errors: Errors, issue: ContractIssue): void {
  const section = issue.path[0];
  const property = String(issue.path[1]);
  if (section === "newStudent") {
    assignStudentIssue(errors, issue);
    return;
  }
  if (section === "newPayer") {
    errors[PAYER_KEYS[property] ?? "payerName"] =
      property === "documentType" ? "Confira o CPF ou RG informado." : issue.message;
    return;
  }
  if (section === "durationMonths") {
    errors.endsOn = "Informe uma data final entre 1 e 120 meses completos após o início.";
    return;
  }
  if (section === "installmentCount") {
    errors.installmentCount =
      "Informe uma quantidade inteira entre 1 e a duração do contrato em meses.";
    return;
  }
  const name = section as keyof ContractFields | "monthlyAmountCents";
  if (name === "monthlyAmountCents") errors.monthlyAmount = "Informe uma mensalidade válida.";
  else if (FORM_KEYS.has(name)) errors[name] = "Confira este campo.";
}

function assignStudentIssue(errors: Errors, issue: ContractIssue): void {
  const property = String(issue.path[1]);
  if (property === "guardian") {
    errors[GUARDIAN_KEYS[String(issue.path[3])] ?? "studentGuardianName"] = issue.message;
  } else {
    errors[STUDENT_KEYS[property] ?? "studentDraftName"] =
      property === "documentType" ? "Confira o CPF ou RG informado." : issue.message;
  }
}

export function fieldErrors(parsed: ParsedInput, hasPreview: boolean): Errors {
  const errors: Errors = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) assignIssue(errors, issue);
  }
  if (parsed.success && !hasPreview)
    errors.monthlyAmount = "A mensalidade acordada deve respeitar o piso autorizado.";
  return errors;
}

function suggestedContractEnd(value: string): string {
  const start = parseDateBR(value);
  return start ? formatDateBR(addCalendarMonths(start, DEFAULT_CONTRACT_MONTHS)) : "";
}

function formatDateBR(value: string): string {
  const [year, month, day] = value.split("-");
  return [day, month, year].join("/");
}

export type ContractFormState = {
  fields: ContractFields;
  errors: Errors;
  submissionError: string;
  commandId: RefObject<string>;
  popup: RefObject<HTMLDivElement | null>;
  change: (name: keyof ContractFields, value: string) => void;
  setSuggestedMonthlyAmount: (tuitionCeilingCents: number) => void;
  reset: () => void;
  setErrors: (errors: Errors) => void;
  setFieldError: (name: keyof ContractFields, error: string | undefined) => void;
  setSubmissionError: (message: string) => void;
};

function useAgreementDate(
  open: boolean,
  setFields: Dispatch<SetStateAction<ContractFields>>,
): void {
  useEffect(() => {
    if (!open) return;
    const today = formatDateBR(toDateOnlySaoPaulo(new Date()));
    setFields((current) => (current.agreedOn ? current : { ...current, agreedOn: today }));
  }, [open, setFields]);
}

function useSuggestedMonthlyAmount(
  setFields: Dispatch<SetStateAction<ContractFields>>,
  edited: RefObject<boolean>,
): (tuitionCeilingCents: number) => void {
  return useCallback(
    (tuitionCeilingCents: number): void => {
      setFields((current) =>
        suggestMonthlyAmount(current, { tuitionCeilingCents, edited: edited.current }),
      );
    },
    [setFields, edited],
  );
}

export function useContractFormState(open: boolean): ContractFormState {
  const [fields, setFields] = useState<ContractFields>(emptyContractFields);
  useAgreementDate(open, setFields);
  const [errors, setErrors] = useState<Errors>({});
  const [submissionError, setSubmissionError] = useState("");
  const commandId = useRef(crypto.randomUUID());
  const popup = useRef<HTMLDivElement>(null);
  const endDateEdited = useRef(false);
  const monthlyAmountEdited = useRef(false);
  const change = (name: keyof ContractFields, value: string): void => {
    if (name === "endsOn") endDateEdited.current = true;
    if (name === "monthlyAmount") monthlyAmountEdited.current = true;
    const updateEnd = name === "firstDueDate" && !endDateEdited.current;
    setFields((current) => ({
      ...current,
      [name]: value,
      ...(updateEnd ? { endsOn: suggestedContractEnd(value) } : {}),
    }));
    setErrors((current) => {
      const next = { ...current };
      delete next[name];
      if (updateEnd) delete next.endsOn;
      return next;
    });
    setSubmissionError("");
  };
  const reset = (): void => {
    endDateEdited.current = false;
    monthlyAmountEdited.current = false;
    setFields(emptyContractFields);
    setErrors({});
    setSubmissionError("");
    commandId.current = crypto.randomUUID();
  };
  const setSuggestedMonthlyAmount = useSuggestedMonthlyAmount(setFields, monthlyAmountEdited);
  return {
    fields,
    errors,
    submissionError,
    commandId,
    popup,
    change,
    setSuggestedMonthlyAmount,
    reset,
    setErrors,
    setFieldError: (name, error) => setErrors((current) => ({ ...current, [name]: error })),
    setSubmissionError,
  };
}

function focusFirstInvalid(popup: RefObject<HTMLDivElement | null>): void {
  requestAnimationFrame(() => {
    const invalid = popup.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    const control = invalid?.querySelector<HTMLElement>("button, input") ?? invalid;
    control?.focus();
  });
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
  validateMonthlyAmount: () => void;
  close: (next: boolean) => void;
  submit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
};

function validatePrice(state: ContractFormState, offer: FormProps["offer"]): void {
  state.setFieldError("monthlyAmount", monthlyAmountError(state.fields.monthlyAmount, offer));
}

function useContractOffer(
  open: boolean,
  suggest: (tuitionCeilingCents: number) => void,
): ContractOperation["offer"] {
  const offer = trpc.finance.readContractOffer.useQuery(undefined, { enabled: open });
  const tuitionCeilingCents = offer.data?.tuitionCeilingCents;
  useEffect(() => {
    if (open && tuitionCeilingCents !== undefined) suggest(tuitionCeilingCents);
  }, [open, tuitionCeilingCents, suggest]);
  return offer;
}

export function useContractOperation(input: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  state: ContractFormState;
}): ContractOperation {
  const { state } = input;
  const offer = useContractOffer(input.open, state.setSuggestedMonthlyAmount);
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
      focusFirstInvalid(state.popup);
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
  return {
    offer,
    preview,
    pending: create.isPending,
    close,
    submit,
    validateMonthlyAmount: () => validatePrice(state, offer.data),
  };
}
