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
import { tuitionFloorCents } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { formatBRLFromCents, formatDateOnlyBR, toDateOnlySaoPaulo } from "~/lib/format";
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
const CENTS_PER_REAL = 100;
const DEFAULT_CONTRACT_MONTHS = 12;
const FORM_KEYS = new Set<keyof ContractFields>([
  "enrollmentFee",
  "scholarshipPct",
  "scholarshipAgreement",
  "studentId",
  "payerId",
  "agreedOn",
  "endsOn",
  "firstDueDate",
]);
type ContractIssue = { path: (string | number)[]; message: string; code?: string };
const STUDENT_KEYS: Record<string, keyof ContractFields> = {
  fullName: "studentDraftName",
  birthDate: "studentBirthDate",
  documentType: "studentDocumentNumber",
  documentNumber: "studentDocumentNumber",
  phone: "studentPhone",
  email: "studentEmail",
};
const GUARDIAN_KEYS: Record<string, keyof ContractFields> = {
  fullName: "studentGuardianName",
  documentType: "studentGuardianDocumentNumber",
  documentNumber: "studentGuardianDocumentNumber",
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
const MATERIAL_KEYS: Record<string, keyof ContractFields> = {
  scholarshipPct: "materialScholarshipPct",
  scholarshipAgreement: "materialScholarshipAgreement",
  stageIds: "materialStageIds",
  category: "materialCategory",
  payment: "materialPayment",
  installmentCount: "materialInstallments",
  priceOverrideCents: "materialCustomPrice",
  cardFeeOverridePct: "materialCardFeePct",
};

function assignMaterialIssue(errors: Errors, ...[property, message]: [string, string]): void {
  const key = MATERIAL_KEYS[property] ?? "materialTotal";
  errors[key] = property === "expectedTotalCents" ? "Aguarde o preço do material." : message;
}

function assignPayerIssue(errors: Errors, issue: ContractIssue): void {
  const property = String(issue.path[1]);
  errors[PAYER_KEYS[property] ?? "payerName"] =
    property === "documentType" ? "Confira o CPF ou RG informado." : issue.message;
}

function assignIssue(errors: Errors, issue: ContractIssue): void {
  if (assignPersonOrMaterialIssue(errors, issue)) return;
  const section = issue.path[0];
  switch (section) {
    case "durationMonths": {
      errors.endsOn = "Informe uma data final entre 1 e 120 meses completos após o início.";
      return;
    }
    case "firstDueDate": {
      errors.billingFirstDueDate = issue.message;
      return;
    }
    case "startsOn": {
      errors.firstDueDate = issue.message;
      return;
    }
    case "installmentCount": {
      errors.installmentCount =
        "Informe uma quantidade inteira entre 1 e a duração do contrato em meses.";
      return;
    }
    default: {
      assignStandardIssue(errors, issue);
    }
  }
}

function assignStandardIssue(errors: Errors, issue: ContractIssue): void {
  const name = issue.path[0] as keyof ContractFields | "monthlyAmountCents" | "enrollmentFeeCents";
  switch (name) {
    case "monthlyAmountCents": {
      errors.monthlyAmount =
        issue.code === "custom" ? issue.message : "Informe uma mensalidade válida.";
      break;
    }
    case "enrollmentFeeCents": {
      errors.enrollmentFee = issue.message;
      break;
    }
    default: {
      if (FORM_KEYS.has(name)) errors[name] = issue.message;
    }
  }
}

function assignPersonOrMaterialIssue(errors: Errors, issue: ContractIssue): boolean {
  const section = issue.path[0];
  switch (section) {
    case "material": {
      assignMaterialIssue(errors, String(issue.path[1]), issue.message);
      return true;
    }
    case "newStudent": {
      assignStudentIssue(errors, issue);
      return true;
    }
    case "newPayer": {
      assignPayerIssue(errors, issue);
      return true;
    }
    default: {
      return false;
    }
  }
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
  return start ? formatDateOnlyBR(addCalendarMonths(start, DEFAULT_CONTRACT_MONTHS)) : "";
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

function useInitialContractDates(
  open: boolean,
  setFields: Dispatch<SetStateAction<ContractFields>>,
): void {
  useEffect(() => {
    if (!open) return;
    const today = formatDateOnlyBR(toDateOnlySaoPaulo(new Date()));
    setFields((current) => {
      if (current.agreedOn && current.firstDueDate && current.endsOn) return current;
      const firstDueDate = current.firstDueDate || today;
      return {
        ...current,
        agreedOn: current.agreedOn || today,
        firstDueDate,
        endsOn: current.endsOn || suggestedContractEnd(firstDueDate),
      };
    });
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

function clearedErrors(
  errors: Errors,
  input: { name: keyof ContractFields; updateEnd: boolean },
): Errors {
  const next = { ...errors };
  delete next[input.name];
  if (input.updateEnd) delete next.endsOn;
  return next;
}

export function useContractFormState(
  open: boolean,
  ...[initialFields = emptyContractFields, suggestAgreementDate = true]: [ContractFields?, boolean?]
): ContractFormState {
  const [fields, setFields] = useState<ContractFields>(initialFields);
  useInitialContractDates(open && suggestAgreementDate, setFields);
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
    setErrors((current) => clearedErrors(current, { name, updateEnd }));
    setSubmissionError("");
  };
  const reset = (): void => {
    endDateEdited.current = false;
    monthlyAmountEdited.current = false;
    setFields(initialFields);
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

export function monthlyAmountError(text: string, offer: FormProps["offer"]): string | undefined {
  const value = text.trim();
  const amount = Math.round(Number(value.replace(",", ".")) * CENTS_PER_REAL);
  if (!/^\d+(?:[.,]\d{1,2})?$/u.test(value) || !Number.isSafeInteger(amount) || amount <= 0) {
    return "Informe uma mensalidade válida.";
  }
  if (!offer) return undefined;
  const floor = tuitionFloorCents(offer.tuitionCeilingCents, offer.maximumDiscountPct);
  if (amount < floor) {
    return `A mensalidade acordada deve ser de pelo menos ${formatBRLFromCents(floor)}.`;
  }
  return undefined;
}

export function validatePrice(state: ContractFormState, offer: FormProps["offer"]): void {
  state.setFieldError("monthlyAmount", monthlyAmountError(state.fields.monthlyAmount, offer));
}

export function useContractOffer(
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

type ContractOperationInput = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  state: ContractFormState;
};

export function useContractOperation(input: ContractOperationInput): ContractOperation {
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
      void utils.students.invalidate();
      input.onCreated();
      state.reset();
      input.onOpenChange(false);
    } catch (error) {
      void utils.finance.readMaterialPrice.invalidate();
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
