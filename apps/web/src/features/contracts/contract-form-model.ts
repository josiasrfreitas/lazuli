import { addCalendarMonths, previewMonthlyContract } from "@lazuli/domain";
import {
  createMonthlyContractInputSchema,
  type studentCreateInputSchema,
  type z,
} from "@lazuli/validators";

import { parseDateBR } from "~/lib/masks";
import { formatBRLFromCents } from "~/lib/format";

const CENTS_PER_REAL = 100;
const MONTHS_PER_YEAR = 12;

export type ContractFields = {
  paymentPlan: string;
  installmentCount: string;
  payerMode: string;
  payerName: string;
  payerDocumentType: string;
  payerDocumentNumber: string;
  payerPhone: string;
  payerEmail: string;
  studentMode: string;
  studentDraftName: string;
  studentDocumentType: string;
  studentDocumentNumber: string;
  studentPhone: string;
  studentEmail: string;
  studentGuardianMode: string;
  studentGuardianName: string;
  studentGuardianPhone: string;
  studentGuardianEmail: string;
  studentId: string;
  studentName: string;
  payerLabel: string;
  payerId: string;
  agreedOn: string;
  endsOn: string;
  firstDueDate: string;
  monthlyAmount: string;
};

export const emptyContractFields: ContractFields = {
  paymentPlan: "common",
  installmentCount: "",
  payerMode: "existing",
  payerName: "",
  payerDocumentType: "",
  payerDocumentNumber: "",
  payerPhone: "",
  payerEmail: "",
  studentMode: "existing",
  studentDraftName: "",
  studentDocumentType: "",
  studentDocumentNumber: "",
  studentPhone: "",
  studentEmail: "",
  studentGuardianMode: "",
  studentGuardianName: "",
  studentGuardianPhone: "",
  studentGuardianEmail: "",
  studentId: "",
  studentName: "",
  payerLabel: "",
  payerId: "",
  agreedOn: "",
  endsOn: "",
  firstDueDate: "",
  monthlyAmount: "",
};

export function paymentPlanLabel(count: number, uniformAmountCents: number | null): string {
  return uniformAmountCents === null
    ? `${count} parcelas · valores variáveis`
    : `${count} × ${formatBRLFromCents(uniformAmountCents)}`;
}

export function suggestMonthlyAmount(
  fields: ContractFields,
  input: { tuitionCeilingCents: number; edited: boolean },
): ContractFields {
  if (input.edited) return fields;
  const monthlyAmount = (input.tuitionCeilingCents / CENTS_PER_REAL).toFixed(2);
  return fields.monthlyAmount === monthlyAmount ? fields : { ...fields, monthlyAmount };
}

function durationFromDates(fields: ContractFields): number {
  const start = parseDateBR(fields.firstDueDate);
  const end = parseDateBR(fields.endsOn);
  if (!start || !end) return Number.NaN;
  const [startYear, startMonth] = start.split("-").map(Number);
  const [endYear, endMonth] = end.split("-").map(Number);
  const months = (endYear! - startYear!) * MONTHS_PER_YEAR + endMonth! - startMonth!;
  return months > 0 && addCalendarMonths(start, months) === end ? months : Number.NaN;
}

function studentInput(fields: ContractFields): object {
  if (fields.studentMode === "existing") return { studentId: fields.studentId };
  const guardian =
    fields.studentGuardianMode === "create"
      ? {
          mode: "create",
          input: {
            fullName: fields.studentGuardianName,
            phone: fields.studentGuardianPhone.trim() || undefined,
            email: fields.studentGuardianEmail.trim() || undefined,
          },
        }
      : undefined;
  return {
    newStudent: {
      fullName: fields.studentDraftName,
      documentType: fields.studentDocumentType || undefined,
      documentNumber: fields.studentDocumentNumber.trim() || undefined,
      phone: fields.studentPhone.trim() || undefined,
      email: fields.studentEmail.trim() || undefined,
      guardian,
    },
  };
}

function payerInput(fields: ContractFields): object {
  if (fields.payerMode === "existing") return { payerId: fields.payerId };
  return {
    newPayer: {
      name: fields.payerName,
      documentType: fields.payerDocumentType || undefined,
      documentNumber: fields.payerDocumentNumber.trim() || undefined,
      phone: fields.payerPhone.trim() || undefined,
      email: fields.payerEmail.trim() || undefined,
    },
  };
}

export function contractInputFromFields(
  fields: ContractFields,
  command: string | { commandId: string; newStudent: z.input<typeof studentCreateInputSchema> },
): ReturnType<typeof createMonthlyContractInputSchema.safeParse> {
  const commandId = typeof command === "string" ? command : command.commandId;
  const beneficiary =
    typeof command === "string" ? studentInput(fields) : { newStudent: command.newStudent };
  const parsed = createMonthlyContractInputSchema.safeParse({
    commandId,
    ...(fields.paymentPlan === "special"
      ? { installmentCount: Number(fields.installmentCount) }
      : {}),
    ...beneficiary,
    ...payerInput(fields),
    agreedOn: parseDateBR(fields.agreedOn),
    startsOn: parseDateBR(fields.firstDueDate),
    durationMonths: durationFromDates(fields),
    firstDueDate: parseDateBR(fields.firstDueDate),
    monthlyAmountCents: Math.round(Number(fields.monthlyAmount.replace(",", ".")) * CENTS_PER_REAL),
  });
  return parsed;
}

export function contractPreview(
  fields: ContractFields,
  offer:
    | {
        tuitionCeilingCents: number;
        maximumDiscountPct: number;
        punctualityDiscountPct: number;
      }
    | null
    | undefined,
): ReturnType<typeof previewMonthlyContract> | null {
  const parsed = contractInputFromFields(fields, "00000000-0000-4000-8000-000000000001");
  return previewContractInput(parsed, offer);
}

export function previewContractInput(
  parsed: ReturnType<typeof contractInputFromFields>,
  offer: Parameters<typeof contractPreview>[1],
): ReturnType<typeof previewMonthlyContract> | null {
  if (!offer || !parsed.success) return null;
  try {
    return previewMonthlyContract({ ...parsed.data, ...offer });
  } catch {
    return null;
  }
}
