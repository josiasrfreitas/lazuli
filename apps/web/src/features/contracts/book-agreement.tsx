import { materialFinalPriceQuote, materialFinalSaleQuote } from "@lazuli/domain";
import type { ContractMaterialInput } from "@lazuli/validators";
import type { SetupMaterial } from "./contract-setup-material";

type Prices = NonNullable<SetupMaterial["prices"]["data"]>;

export function bookQuote(terms: ContractMaterialInput, prices: Prices) {
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

export function BookAgreement({
  terms,
  change,
}: {
  terms: ContractMaterialInput;
  change: (terms: ContractMaterialInput) => void;
}) {
  const control = "h-9 rounded-sm border border-border bg-background px-2";
  return (
    <details className="sm:col-span-2">
      <summary className="cursor-pointer">Condições especiais do livro</summary>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <label className="grid">
          Preço negociado (R$)
          <input
            className={control}
            type="number"
            min="0.01"
            step="0.01"
            value={terms.priceOverrideCents == null ? "" : terms.priceOverrideCents / 100}
            onChange={(e) => {
              const n = e.target.valueAsNumber;
              if (!e.target.value || n > 0)
                change({
                  ...terms,
                  priceOverrideCents: e.target.value ? Math.round(n * 100) : undefined,
                });
            }}
          />
        </label>
        {terms.payment === "INSTALLMENTS" && (
          <label className="grid">
            Taxa do cartão (%)
            <input
              className={control}
              type="number"
              min="0"
              max="99.9999"
              step="0.0001"
              value={terms.cardFeeOverridePct ?? ""}
              onChange={(e) => {
                const n = e.target.valueAsNumber;
                if (!e.target.value || (n >= 0 && n < 100))
                  change({ ...terms, cardFeeOverridePct: e.target.value ? n : undefined });
              }}
            />
          </label>
        )}
        <label className="grid">
          Bolsa de material (%)
          <input
            className={control}
            type="number"
            min="0"
            max="100"
            step="0.0001"
            value={terms.scholarshipPct ?? ""}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (n >= 0 && n <= 100)
                change({
                  ...terms,
                  scholarshipPct: n || undefined,
                  scholarshipAgreement: n ? terms.scholarshipAgreement : undefined,
                  ...(n === 100
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
              className={control}
              value={terms.scholarshipAgreement ?? ""}
              onChange={(e) => change({ ...terms, scholarshipAgreement: e.target.value })}
            />
          </label>
        )}
      </div>
    </details>
  );
}
