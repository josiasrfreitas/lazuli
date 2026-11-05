import type { ContractFields } from "./contract-form-model";

const MAX_PERCENT = 100;
const PERCENT_DECIMAL_PLACES = 4;

export function materialCardFeeInput(fields: ContractFields): { cardFeeOverridePct?: number } {
  if (
    fields.materialPayment !== "INSTALLMENTS" ||
    fields.materialScholarshipMode === "FULL" ||
    fields.materialCardFeeMode !== "CUSTOM"
  )
    return {};
  return {
    cardFeeOverridePct: fields.materialCardFeePct.trim()
      ? Number(fields.materialCardFeePct.replace(",", "."))
      : Number.NaN,
  };
}

export function selectedMaterialCardFee(
  fields: ContractFields,
  rates: Record<string, number> | undefined,
): number | undefined {
  if (fields.materialPayment !== "INSTALLMENTS" || fields.materialScholarshipMode === "FULL")
    return 0;
  return (
    materialCardFeeInput(fields).cardFeeOverridePct ??
    rates?.[String(Number(fields.materialInstallments))]
  );
}

export function materialCardFeeError(
  fields: ContractFields,
  rates: Record<string, number> | undefined,
): string {
  if (fields.materialPayment !== "INSTALLMENTS" || fields.materialScholarshipMode === "FULL")
    return "";
  const rate = selectedMaterialCardFee(fields, rates);
  if (rate === undefined)
    return rates ? "Informe a taxa desta compra ou cadastre a taxa padrão em Ajustes." : "";
  if (!Number.isFinite(rate) || rate < 0 || rate >= MAX_PERCENT)
    return "Informe uma taxa de 0% a menos de 100%.";
  if (Number(rate.toFixed(PERCENT_DECIMAL_PLACES)) !== rate)
    return "Use até quatro casas decimais na taxa.";
  return "";
}

export function materialCardFeeLabel(rate: number): string {
  return `${rate.toLocaleString("pt-BR", { maximumFractionDigits: PERCENT_DECIMAL_PLACES })}%`;
}
