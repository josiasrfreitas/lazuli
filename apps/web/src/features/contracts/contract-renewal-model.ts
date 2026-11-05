"use client";

import { useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { addCalendarMonths, previewMonthlyContract } from "@lazuli/domain";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR, toDateOnlySaoPaulo } from "~/lib/format";
import { maskDateBR, parseDateBR } from "~/lib/masks";
import {
  emptyContractFields,
  contractInputFromFields,
  type ContractFields,
} from "~/features/contracts/contract-form-model";
import {
  useContractFormState,
  fieldErrors,
  type ContractFormState,
} from "~/features/contracts/new-contract-state";

const CENTS_PER_REAL = 100;
const FULL_SCHOLARSHIP_PERCENT = 100;
const CALENDAR_UTC_HOUR = 12;
const ISO_DATE_LENGTH = 10;
type RenewalTerms = RouterOutputs["finance"]["renewalTerms"];
export type RenewalModel = {
  state: ContractFormState;
  restoreTerms: () => void;
  firstDueDate: string;
  dueError: string;
  preview: ReturnType<typeof previewMonthlyContract> | null;
  pending: boolean;
  error: string | undefined;
  submit: (event: FormEvent<HTMLFormElement>) => void;
  changeDueDate: (value: string) => void;
};
type RenewalDue = Pick<RenewalModel, "firstDueDate" | "dueError" | "changeDueDate"> & {
  setDueError: Dispatch<SetStateAction<string>>;
};

export function useRenewalModel({
  data,
  onClose,
  onSaved,
}: {
  data: RenewalTerms;
  onClose: () => void;
  onSaved: () => void;
}): RenewalModel {
  const [initial] = useState(() => emptyRenewalFields(data));
  const state = useContractFormState(true, initial, false);
  const due = useRenewalDueDate();
  const restoreTerms = (): void => restoreRenewalTerms(data, { state, due });
  const preview = renewalPreview({ data, state, firstDueDate: due.firstDueDate });
  const utils = trpc.useUtils();
  const mutation = trpc.finance.createMonthlyContract.useMutation({
    onSuccess: async () => {
      await invalidateRenewal(utils);
      onSaved();
      onClose();
    },
  });
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (mutation.isPending) return;
    const values = contractInputFromFields(state.fields, state.commandId.current, data.id);
    const parsedDate = parseDateBR(due.firstDueDate);
    if (!parsedDate) {
      due.setDueError("Informe um primeiro vencimento válido.");
      return;
    }
    if (!values.success || !preview) {
      state.setErrors(fieldErrors(values, Boolean(preview)));
      return;
    }
    mutation.mutate({ ...values.data, firstDueDate: parsedDate, renewedFromId: data.id });
  };
  return {
    state,
    restoreTerms,
    ...due,
    preview,
    pending: mutation.isPending,
    error: mutation.error?.message,
    submit,
  };
}

function emptyRenewalFields(data: RenewalTerms): ContractFields {
  return {
    ...emptyContractFields,
    materialPayment: "NONE",
    studentId: data.student.id,
    studentName: data.student.fullName,
  };
}

async function invalidateRenewal(utils: ReturnType<typeof trpc.useUtils>): Promise<void> {
  await Promise.all([
    utils.finance.invalidate(),
    utils.semesterOrganization.invalidate(),
    utils.students.invalidate(),
    utils.dashboard.invalidate(),
  ]);
}

function restoreRenewalTerms(
  data: RenewalTerms,
  { state, due }: { state: ContractFormState; due: RenewalDue },
): void {
  const previous = initialRenewalFields(data);
  for (const key of Object.keys(previous) as Array<keyof ContractFields>) {
    const value = previous[key];
    if (!key.startsWith("material") && value !== undefined) state.change(key, value);
  }
  due.changeDueDate(initialDueDate(data, previous.firstDueDate));
  state.setErrors({});
}

function useRenewalDueDate(): RenewalDue {
  const [firstDueDate, setFirstDueDate] = useState("");
  const [dueError, setDueError] = useState("");
  return {
    firstDueDate,
    dueError,
    setDueError,
    changeDueDate: (value) => {
      setFirstDueDate(maskDateBR(value));
      setDueError("");
    },
  };
}

function initialRenewalFields(data: RenewalTerms): ContractFields {
  const next = new Date(`${data.endsOn}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const start = next.toISOString().slice(0, ISO_DATE_LENGTH);
  return {
    ...emptyContractFields,
    materialPayment: "NONE",
    studentId: data.student.id,
    studentName: data.student.fullName,
    payerId: data.payer.id,
    payerLabel: data.payer.name,
    payerName: data.payer.name,
    payerDocumentType: data.payer.documentType ?? "",
    payerDocumentNumber: data.payer.documentNumber ?? "",
    payerPhone: data.payer.phone ?? "",
    payerEmail: data.payer.email ?? "",
    monthlyAmount: (data.baseMonthlyAmountCents / CENTS_PER_REAL).toFixed(2),
    scholarshipMode: renewalScholarshipMode(data.scholarshipPct),
    scholarshipPct: data.scholarshipPct ? String(data.scholarshipPct) : "",
    scholarshipAgreement: data.scholarshipAgreement ?? "",
    agreedOn: formatDateOnlyBR(toDateOnlySaoPaulo(new Date())),
    firstDueDate: formatDateOnlyBR(start),
    endsOn: formatDateOnlyBR(addCalendarMonths(start, data.durationMonths)),
    paymentPlan: data.installmentCount === data.durationMonths ? "common" : "special",
    installmentCount: String(data.installmentCount),
  };
}

function renewalScholarshipMode(percent: number): ContractFields["scholarshipMode"] {
  if (percent === FULL_SCHOLARSHIP_PERCENT) return "FULL";
  return percent > 0 ? "PARTIAL" : "NONE";
}

function initialDueDate(data: RenewalTerms, firstDueDate: string): string {
  const start = new Date(`${parseDateBR(firstDueDate)}T12:00:00Z`);
  const date = new Date(
    Date.UTC(
      start.getUTCFullYear(),
      start.getUTCMonth(),
      Math.min(
        data.dueDay,
        new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate(),
      ),
      CALENDAR_UTC_HOUR,
    ),
  );
  if (date < start) {
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + 1);
    date.setUTCDate(
      Math.min(
        data.dueDay,
        new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate(),
      ),
    );
  }
  return formatDateOnlyBR(date.toISOString().slice(0, ISO_DATE_LENGTH));
}

function renewalPreview({
  data,
  state,
  firstDueDate,
}: {
  data: RenewalTerms;
  state: ContractFormState;
  firstDueDate: string;
}): ReturnType<typeof previewMonthlyContract> | null {
  const parsed = contractInputFromFields(state.fields, state.commandId.current, data.id);
  const dueDate = parseDateBR(firstDueDate);
  if (!parsed.success || !dueDate) return null;
  try {
    return previewMonthlyContract({ ...parsed.data, firstDueDate: dueDate, ...data.offer });
  } catch {
    /* Invalid drafts remain editable until submission. */
    return null;
  }
}
