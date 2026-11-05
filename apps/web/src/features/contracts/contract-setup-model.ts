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
const MAX_CONTRACT_MONTHS = 120;
const PERCENT_DIVISOR = 100;

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
export function setupTuitionPreview({
  fields,
  offer,
  billingFirstDueDate,
}: {
  fields: ContractFields;
  offer: FormProps["offer"];
  billingFirstDueDate?: string | undefined;
}): FormProps["preview"] {
  const start = parseDateBR(fields.firstDueDate);
  const due = billingFirstDueDate ?? parseDateBR(fields.billingFirstDueDate ?? fields.firstDueDate);
  const duration = durationFromDates(fields);
  if (!offer || !start || !due || !validDuration(duration)) return null;
  if (monthlyAmountError(fields.monthlyAmount, offer)) return null;
  try {
    return previewMonthlyContract({
      ...offer,
      startsOn: start,
      firstDueDate: due,
      durationMonths: duration,
      monthlyAmountCents: Math.round(
        Number(fields.monthlyAmount.replace(",", ".")) * PERCENT_DIVISOR,
      ),
      ...scholarshipInput(fields),
      ...paymentPlanInput(fields),
    });
  } catch {
    return null;
  }
}

function paymentPlanInput(fields: ContractFields): { installmentCount?: number } {
  return fields.paymentPlan === "special" && fields.scholarshipMode !== "FULL"
    ? { installmentCount: Number(fields.installmentCount) }
    : {};
}

function validDuration(duration: number): boolean {
  return Number.isInteger(duration) && duration >= 1 && duration <= MAX_CONTRACT_MONTHS;
}

export function setupPlanLabel(preview: FormProps["preview"]): string {
  if (!preview) return "Valores a definir";
  if (preview.installments.length === 0) return "Bolsa integral";
  const first = preview.installments[0]?.amountCents ?? null;
  return paymentPlanLabel(
    preview.installments.length,
    preview.installments.every((row) => row.amountCents === first) ? first : null,
  );
}

export function setupValidation({
  fields,
  commandId,
  offer,
  parsed,
}: {
  fields: ContractFields;
  commandId: string;
  offer: FormProps["offer"];
  parsed?: ReturnType<typeof contractInputFromFields> | undefined;
}): SetupErrors {
  const errors = fieldErrors(parsed ?? contractInputFromFields(fields, commandId), true);
  validatePartyFields(fields, errors);
  validateTuitionFields(fields, { offer, errors });
  validateMaterialFields(fields, errors);
  return errors;
}

function validatePartyFields(fields: ContractFields, errors: SetupErrors): void {
  if (fields.studentMode === "existing" && !fields.studentId)
    errors.studentId = "Selecione o aluno.";
  if (fields.payerMode === "existing" && !fields.payerId)
    errors.payerId = "Selecione o responsável financeiro.";
  if (!parseDateBR(fields.agreedOn)) errors.agreedOn = "Informe a data do acordo.";
  if (!parseDateBR(fields.firstDueDate)) errors.firstDueDate = "Informe o início do contrato.";
  if (!parseDateBR(fields.billingFirstDueDate ?? fields.firstDueDate))
    errors.billingFirstDueDate = "Informe o primeiro vencimento.";
}

function validateTuitionFields(
  fields: ContractFields,
  { offer, errors }: { offer: FormProps["offer"]; errors: SetupErrors },
): void {
  const priceError = monthlyAmountError(fields.monthlyAmount, offer);
  if (priceError) errors.monthlyAmount = priceError;
  const duration = durationFromDates(fields);
  validateInstallmentCount(fields, { duration, errors });
  if (fields.scholarshipMode !== "NONE" && !fields.scholarshipAgreement.trim()) {
    errors.scholarshipAgreement = "Descreva o acordo da bolsa.";
  }
  const hasTuitionError = Object.keys(errors).some((key) => stepForField(key) === "tuition");
  if (
    offer &&
    !hasTuitionError &&
    validDuration(duration) &&
    !setupTuitionPreview({ fields, offer })
  )
    errors.monthlyAmount = "Confira a mensalidade, a bolsa e a quantidade de parcelas.";
}

function validateInstallmentCount(
  fields: ContractFields,
  { duration, errors }: { duration: number; errors: SetupErrors },
): void {
  if (fields.paymentPlan !== "special" || fields.scholarshipMode === "FULL") return;
  const count = Number(fields.installmentCount);
  if (!Number.isInteger(count) || count < 1 || count > duration)
    errors.installmentCount = "Informe de 1 até o número de meses do contrato.";
}

function validateMaterialFields(fields: ContractFields, errors: SetupErrors): void {
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
}

export function firstInvalidStep(errors: SetupErrors): SetupStep | undefined {
  return setupSteps.find((step) =>
    Object.entries(errors).some(([key, value]) => value && stepForField(key) === step),
  );
}
