import { useId, useState, type ReactElement } from "react";
import { CurrencyInput, Field, Input, Label } from "@lazuli/ui";
import { materialFinalPriceQuote, materialFinalSaleQuote } from "@lazuli/domain";
import type { ContractMaterialInput } from "@lazuli/validators";
import type { SetupMaterial } from "./contract-setup-material";

type Prices = NonNullable<SetupMaterial["prices"]["data"]>;

const FULL_PERCENT = 100;

export function bookQuote(
  terms: ContractMaterialInput,
  prices: Prices,
): { reference: number; charged: number } {
  const unit = terms.category === "CHILD" ? prices.child : prices.adult;
  const fee =
    terms.payment === "CASH"
      ? 0
      : (terms.cardFeeOverridePct ?? prices.cardFeeRates[String(terms.installmentCount)] ?? 0);
  const quote = materialFinalPriceQuote({ cashCents: unit.cashCents, cardFeePct: fee });
  return {
    reference: terms.payment === "CASH" ? quote.cashCents : quote.totalCents,
    charged: materialFinalSaleQuote({
      quote,
      payment: terms.payment,
      scholarshipPct: terms.scholarshipPct ?? 0,
      priceOverrideCents: terms.priceOverrideCents,
      cardFeePct: fee,
    }).chargedCents,
  };
}

type AgreementProps = {
  terms: ContractMaterialInput;
  change: (terms: ContractMaterialInput) => void;
};

export function BookAgreement({ terms, change }: AgreementProps): ReactElement {
  const id = useId();
  return (
    <details className="min-w-0 sm:col-span-2">
      <summary className="w-fit cursor-pointer text-sm font-medium">Ajustar preço e bolsa</summary>
      <div className="mt-3 flex flex-wrap items-start gap-x-4 gap-y-3">
        <Field name={id + "-price"} className="w-36 max-w-full">
          <Label>Preço negociado</Label>
          <CurrencyInput
            size="xs"
            value={terms.priceOverrideCents ?? null}
            placeholder="R$ 0,00"
            onValueChange={(value) => change({ ...terms, priceOverrideCents: value ?? undefined })}
          />
        </Field>
        {terms.payment === "INSTALLMENTS" && (
          <BookPercentField
            label="Taxa do cartão (%)"
            placeholder="Ex.: 2,5"
            value={terms.cardFeeOverridePct}
            maximum={99.9999}
            change={(value) => change({ ...terms, cardFeeOverridePct: value })}
          />
        )}
        <BookPercentField
          label="Bolsa do material (%)"
          placeholder="Ex.: 25"
          value={terms.scholarshipPct}
          maximum={FULL_PERCENT}
          change={(value) =>
            change({
              ...terms,
              scholarshipPct: value || undefined,
              scholarshipAgreement: value ? terms.scholarshipAgreement : undefined,
              ...(value === FULL_PERCENT
                ? { payment: "CASH", installmentCount: 1, cardFeeOverridePct: undefined }
                : {}),
            })
          }
        />
      </div>
      {Boolean(terms.scholarshipPct) && (
        <Field name={id + "-reason"} className="mt-3 w-full max-w-sm">
          <Label>Motivo da bolsa</Label>
          <Input
            size="xs"
            placeholder="Ex.: convênio com a escola"
            value={terms.scholarshipAgreement ?? ""}
            onChange={(event) => change({ ...terms, scholarshipAgreement: event.target.value })}
          />
        </Field>
      )}
    </details>
  );
}

export function BookPercentField({
  label,
  placeholder,
  value,
  maximum,
  change,
}: {
  label: string;
  placeholder: string;
  value: number | null | undefined;
  maximum: number;
  change: (value: number | undefined) => void;
}): ReactElement {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <Field name={id} className="w-36 max-w-full">
      <Label>{label}</Label>
      <Input
        size="xs"
        inputMode="decimal"
        placeholder={placeholder}
        value={draft ?? String(value ?? "").replace(".", ",")}
        onChange={(event) => {
          const text = event.target.value.replace(".", ",");
          const number = Number(text.replace(",", "."));
          if (!/^\d{0,3}(?:,\d{0,4})?$/.test(text) || number > maximum) return;
          setDraft(text);
          change(text && Number.isFinite(number) ? number : undefined);
        }}
        onBlur={() => setDraft(null)}
      />
    </Field>
  );
}
