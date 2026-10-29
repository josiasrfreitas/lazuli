import { previewMonthlyContract } from "@lazuli/domain";
import { parseDateBR } from "~/lib/masks";
import type { FormProps } from "./contract-form-fields";
import {
  contractInputFromFields,
  durationFromDates,
  paymentPlanLabel,
  scholarshipInput,
  type ContractFields,
} from "./contract-form-model";
import { fieldErrors, monthlyAmountError } from "./new-contract-state";

export const setupSteps = ["parties", "tuition", "material", "review"] as const;
export type SetupStep = (typeof setupSteps)[number];
export type SetupErrors = FormProps["errors"];

export const setupTitles: Record<SetupStep, string> = {
  parties: "Responsável e período",
  tuition: "Mensalidades",
  material: "Material didático",
  review: "Conferir contrato",
};

export function stepForField(name: string): SetupStep {
  if (name.startsWith("material")) return "material";
  if (
    name.startsWith("scholarship") ||
    ["monthlyAmount", "enrollmentFee", "paymentPlan", "installmentCount"].includes(name)
  )
    return "tuition";
  return "parties";
}

/** Tuition stays visible while unrelated party or material fields are incomplete. */
export function setupTuitionPreview(
  fields: ContractFields,
  offer: FormProps["offer"],
  billingFirstDueDate?: string,
): FormProps["preview"] {
  const start = parseDateBR(fields.firstDueDate);
  const duration = durationFromDates(fields);
  if (!offer || !start || !Number.isInteger(duration) || duration < 1 || duration > 120)
    return null;
  if (monthlyAmountError(fields.monthlyAmount, offer)) return null;
  try {
    return previewMonthlyContract({
      ...offer,
      startsOn: start,
      firstDueDate: billingFirstDueDate ?? start,
      durationMonths: duration,
      monthlyAmountCents: Math.round(Number(fields.monthlyAmount.replace(",", ".")) * 100),
      ...scholarshipInput(fields),
      ...(fields.paymentPlan === "special" && fields.scholarshipMode !== "FULL"
        ? { installmentCount: Number(fields.installmentCount) }
        : {}),
    });
  } catch {
    return null;
  }
}

export function setupPlanLabel(preview: FormProps["preview"]): string {
  if (!preview) return "Valores a definir";
  if (!preview.installments.length) return "Bolsa integral";
  const first = preview.installments[0]?.amountCents ?? null;
  return paymentPlanLabel(
    preview.installments.length,
    preview.installments.every((row) => row.amountCents === first) ? first : null,
  );
}

export function setupValidation(
  fields: ContractFields,
  commandId: string,
  offer: FormProps["offer"],
  parsed = contractInputFromFields(fields, commandId),
): SetupErrors {
  const errors = fieldErrors(parsed, true);
  if (fields.studentMode === "existing" && !fields.studentId)
    errors.studentId = "Selecione o aluno.";
  if (fields.payerMode === "existing" && !fields.payerId)
    errors.payerId = "Selecione o responsável financeiro.";
  if (!parseDateBR(fields.agreedOn)) errors.agreedOn = "Informe a data do acordo.";
  if (!parseDateBR(fields.firstDueDate)) errors.firstDueDate = "Informe o início do contrato.";
  const priceError = monthlyAmountError(fields.monthlyAmount, offer);
  if (priceError) errors.monthlyAmount = priceError;
  const duration = durationFromDates(fields);
  if (fields.paymentPlan === "special" && fields.scholarshipMode !== "FULL") {
    const count = Number(fields.installmentCount);
    if (!Number.isInteger(count) || count < 1 || count > duration) {
      errors.installmentCount = "Informe de 1 até o número de meses do contrato.";
    }
  }
  if (fields.scholarshipMode !== "NONE" && !fields.scholarshipAgreement.trim()) {
    errors.scholarshipAgreement = "Descreva o acordo da bolsa.";
  }
  if (fields.materialPayment !== "NONE") {
    if (fields.materialStageIds.split(",").some((id) => !id)) {
      errors.materialStageIds = "Selecione o livro ou remova a linha vazia.";
    }
    if (!fields.materialCategory) errors.materialCategory = "Escolha a faixa de preço.";
    if (!fields.materialQuoteVersion || !fields.materialTotal) {
      errors.materialTotal = "Aguarde a cotação do material antes de continuar.";
    }
    if (fields.materialScholarshipMode !== "NONE" && !fields.materialScholarshipAgreement.trim()) {
      errors.materialScholarshipAgreement = "Descreva o acordo da bolsa de material.";
    }
  }
  const hasTuitionError = Object.keys(errors).some((key) => stepForField(key) === "tuition");
  if (
    offer &&
    !hasTuitionError &&
    Number.isInteger(duration) &&
    !setupTuitionPreview(fields, offer)
  ) {
    errors.monthlyAmount = "Confira a mensalidade, a bolsa e a quantidade de parcelas.";
  }
  return errors;
}

export function firstInvalidStep(errors: SetupErrors): SetupStep | undefined {
  return setupSteps.find((step) =>
    Object.entries(errors).some(([key, value]) => value && stepForField(key) === step),
  );
}
