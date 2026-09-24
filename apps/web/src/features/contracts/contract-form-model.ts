import { previewMonthlyContract } from "@lazuli/domain";
import { createMonthlyContractInputSchema } from "@lazuli/validators";

import { parseDateBR } from "~/lib/masks";

const CENTS_PER_REAL = 100;

export type ContractFields = {
  studentId: string;
  payerId: string;
  agreedOn: string;
  startsOn: string;
  durationMonths: string;
  firstDueDate: string;
  monthlyAmount: string;
  punctualityDiscountPct: string;
};

export const emptyContractFields: ContractFields = {
  studentId: "",
  payerId: "",
  agreedOn: "",
  startsOn: "",
  durationMonths: "12",
  firstDueDate: "",
  monthlyAmount: "",
  punctualityDiscountPct: "0",
};

export function contractInputFromFields(
  fields: ContractFields,
  commandId: string,
): ReturnType<typeof createMonthlyContractInputSchema.safeParse> {
  const parsed = createMonthlyContractInputSchema.safeParse({
    commandId,
    studentId: fields.studentId,
    payerId: fields.payerId,
    agreedOn: parseDateBR(fields.agreedOn),
    startsOn: parseDateBR(fields.startsOn),
    durationMonths: Number(fields.durationMonths),
    firstDueDate: parseDateBR(fields.firstDueDate),
    monthlyAmountCents: Math.round(Number(fields.monthlyAmount.replace(",", ".")) * CENTS_PER_REAL),
    punctualityDiscountPct: Number(fields.punctualityDiscountPct.replace(",", ".")),
  });
  return parsed;
}

export function contractPreview(
  fields: ContractFields,
  offer:
    | {
        tuitionCeilingCents: number;
        maximumDiscountPct: number;
      }
    | null
    | undefined,
): ReturnType<typeof previewMonthlyContract> | null {
  if (!offer) return null;
  const parsed = contractInputFromFields(fields, "00000000-0000-4000-8000-000000000001");
  if (!parsed.success) return null;
  try {
    return previewMonthlyContract({ ...parsed.data, ...offer });
  } catch {
    return null;
  }
}
