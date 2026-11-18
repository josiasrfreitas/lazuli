import type { ReactElement } from "react";
import { materialFinalPriceQuote, materialFinalSaleQuote } from "@lazuli/domain";
import type { ContractMaterialInput } from "@lazuli/validators";
import type { SetupMaterial } from "./contract-setup-material";

type Prices = NonNullable<SetupMaterial["prices"]["data"]>;

const CENTS_PER_REAL = 100;
const FULL_PERCENT = 100;
const AGREEMENT_FIELD_CLASS = "h-9 rounded-sm border border-border bg-background px-2";

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
  return (
    <details className="sm:col-span-2">
      <summary className="cursor-pointer">Condições especiais do livro</summary>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <NegotiatedBookPrice terms={terms} change={change} />
        <BookScholarship terms={terms} change={change} />
      </div>
    </details>
  );
}

function NegotiatedBookPrice({ terms, change }: AgreementProps): ReactElement {
  return (
    <>
      <label className="grid">
        Preço negociado (R$)
        <input
          className={AGREEMENT_FIELD_CLASS}
          type="number"
          min="0.01"
          step="0.01"
          value={
            terms.priceOverrideCents === undefined || terms.priceOverrideCents === null
              ? ""
              : terms.priceOverrideCents / CENTS_PER_REAL
          }
          onChange={(event) => {
            const value = event.target.valueAsNumber;
            if (!event.target.value || value > 0)
              change({
                ...terms,
                priceOverrideCents: event.target.value
                  ? Math.round(value * CENTS_PER_REAL)
                  : undefined,
              });
          }}
        />
      </label>
      {terms.payment === "INSTALLMENTS" && (
        <label className="grid">
          Taxa do cartão (%)
          <input
            className={AGREEMENT_FIELD_CLASS}
            type="number"
            min="0"
            max="99.9999"
            step="0.0001"
            value={terms.cardFeeOverridePct ?? ""}
            onChange={(event) => {
              const value = event.target.valueAsNumber;
              if (!event.target.value || (value >= 0 && value < FULL_PERCENT))
                change({ ...terms, cardFeeOverridePct: event.target.value ? value : undefined });
            }}
          />
        </label>
      )}
    </>
  );
}

function BookScholarship({ terms, change }: AgreementProps): ReactElement {
  return (
    <>
      <label className="grid">
        Bolsa de material (%)
        <input
          className={AGREEMENT_FIELD_CLASS}
          type="number"
          min="0"
          max="100"
          step="0.0001"
          value={terms.scholarshipPct ?? ""}
          onChange={(event) => {
            const value = Number(event.target.value);
            if (value >= 0 && value <= FULL_PERCENT)
              change({
                ...terms,
                scholarshipPct: value || undefined,
                scholarshipAgreement: value ? terms.scholarshipAgreement : undefined,
                ...(value === FULL_PERCENT
                  ? { payment: "CASH", installmentCount: 1, cardFeeOverridePct: undefined }
                  : {}),
              });
          }}
        />
      </label>
      {Boolean(terms.scholarshipPct) && (
        <label className="grid">
          Acordo da bolsa
          <input
            className={AGREEMENT_FIELD_CLASS}
            value={terms.scholarshipAgreement ?? ""}
            onChange={(event) => change({ ...terms, scholarshipAgreement: event.target.value })}
          />
        </label>
      )}
    </>
  );
}
