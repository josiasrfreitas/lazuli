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
  // Comma-separated UUID draft keeps the shared string-field form interface; commas preserve empty book slots.
  materialStageIds: string;
  materialCategory: string;
  materialPayment: string;
  materialInstallments: string;
  materialPriceMode: string;
  materialCustomPrice: string;
  materialTotal: string;
  materialQuoteVersion: string;
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
  studentBirthDate: string;
  studentDocumentType: string;
  studentDocumentNumber: string;
  studentPhone: string;
  studentEmail: string;
  studentGuardianMode: string;
  studentGuardianName: string;
  studentGuardianDocumentType: string;
  studentGuardianDocumentNumber: string;
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
  enrollmentFee: string;
  materialScholarshipMode: string;
  materialScholarshipPct: string;
  materialScholarshipAgreement: string;
  scholarshipMode: string;
  scholarshipPct: string;
  scholarshipAgreement: string;
};

export const emptyContractFields: ContractFields = {
  materialStageIds: "",
  materialCategory: "",
  materialPayment: "CASH",
  materialInstallments: "6",
  materialPriceMode: "REFERENCE",
  materialCustomPrice: "",
  materialTotal: "",
  materialQuoteVersion: "",
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
  studentBirthDate: "",
  studentDocumentType: "",
  studentDocumentNumber: "",
  studentPhone: "",
  studentEmail: "",
  studentGuardianMode: "",
  studentGuardianName: "",
  studentGuardianDocumentType: "",
  studentGuardianDocumentNumber: "",
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
  enrollmentFee: "0",
  materialScholarshipMode: "NONE",
  materialScholarshipPct: "",
  materialScholarshipAgreement: "",
  scholarshipMode: "NONE",
  scholarshipPct: "",
  scholarshipAgreement: "",
};

export function paymentPlanLabel(count: number, uniformAmountCents: number | null): string {
  if (count === 0) return "Sem parcelas de mensalidade";
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

export function durationFromDates(fields: ContractFields): number {
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
  const birthDate = parseDateBR(fields.studentBirthDate);
  const guardian =
    fields.studentGuardianMode === "create"
      ? {
          mode: "create",
          input: {
            fullName: fields.studentGuardianName,
            documentType: fields.studentGuardianDocumentType || undefined,
            documentNumber: fields.studentGuardianDocumentNumber.trim() || undefined,
            phone: fields.studentGuardianPhone.trim() || undefined,
            email: fields.studentGuardianEmail.trim() || undefined,
          },
        }
      : undefined;
  return {
    newStudent: {
      fullName: fields.studentDraftName,
      birthDate: birthDate ? new Date(`${birthDate}T00:00:00.000Z`) : undefined,
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
  renewedFromId?: string,
): ReturnType<typeof createMonthlyContractInputSchema.safeParse> {
  const commandId = typeof command === "string" ? command : command.commandId;
  const beneficiary =
    typeof command === "string" ? studentInput(fields) : { newStudent: command.newStudent };
  const parsed = createMonthlyContractInputSchema.safeParse({
    commandId,
    ...(renewedFromId ? { renewedFromId } : {}),
    ...(fields.materialPayment === "NONE"
      ? {}
      : {
          material: {
            ...scholarshipInput(fields, true),
            ...materialPriceInput(fields),
            stageIds: fields.materialStageIds.split(","),
            quoteVersion: fields.materialQuoteVersion,
            category: fields.materialCategory,
            payment: fields.materialPayment,
            installmentCount: materialInstallmentCount(fields),
            expectedTotalCents:
              fields.materialTotal === "" ? Number.NaN : Number(fields.materialTotal),
          },
        }),
    ...(fields.paymentPlan === "special" && fields.scholarshipMode !== "FULL"
      ? { installmentCount: Number(fields.installmentCount) }
      : {}),
    ...scholarshipInput(fields),
    ...beneficiary,
    ...payerInput(fields),
    agreedOn: parseDateBR(fields.agreedOn),
    startsOn: parseDateBR(fields.firstDueDate),
    durationMonths: durationFromDates(fields),
    firstDueDate: parseDateBR(fields.firstDueDate),
    monthlyAmountCents: Math.round(Number(fields.monthlyAmount.replace(",", ".")) * CENTS_PER_REAL),
    ...(fields.enrollmentFee.trim()
      ? {
          enrollmentFeeCents: Math.round(
            Number(fields.enrollmentFee.replace(",", ".")) * CENTS_PER_REAL,
          ),
        }
      : {}),
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

export function materialInstallmentCount(fields: ContractFields): number {
  return fields.materialPayment === "CASH" || fields.materialScholarshipMode === "FULL"
    ? 1
    : Number(fields.materialInstallments);
}

export function materialPriceInput(fields: ContractFields): { priceOverrideCents?: number } {
  return fields.materialPriceMode === "CUSTOM"
    ? {
        priceOverrideCents: fields.materialCustomPrice.trim()
          ? Math.round(Number(fields.materialCustomPrice.replace(",", ".")) * 100)
          : Number.NaN,
      }
    : {};
}

export function scholarshipInput(
  fields: ContractFields,
  material = false,
): { scholarshipPct?: number; scholarshipAgreement?: string } {
  const mode = material ? fields.materialScholarshipMode : fields.scholarshipMode;
  if (mode === "NONE") return {};
  const percent = Number(
    (material ? fields.materialScholarshipPct : fields.scholarshipPct).replace(",", "."),
  );
  return {
    scholarshipPct: mode === "FULL" ? 100 : percent > 0 && percent < 100 ? percent : Number.NaN,
    scholarshipAgreement: material
      ? fields.materialScholarshipAgreement
      : fields.scholarshipAgreement,
  };
}
