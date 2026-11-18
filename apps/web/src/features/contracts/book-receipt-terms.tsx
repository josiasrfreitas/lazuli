"use client";
import { useId, useState, type ReactElement } from "react";
import type { ContractMaterialInput } from "@lazuli/validators";
import { SelectControl } from "~/features/classes/form-controls";
import { formatBRLFromCents as money } from "~/lib/format";
import { trpc } from "~/lib/trpc";
import { BookAgreement, bookQuote } from "./book-agreement";
import type { SetupMaterial } from "./contract-setup-material";

type Prices = NonNullable<SetupMaterial["prices"]["data"]>;
type Stage = NonNullable<SetupMaterial["stages"]["data"]>[number];

export function initialBookTerms(stage: Stage, prices: Prices): ContractMaterialInput {
  const child = stage.track.ageGroup === "CHILD";
  const unit = child ? prices.child : prices.adult;
  return {
    stageIds: [stage.id],
    category: child ? "CHILD" : "ADULT",
    payment: "CASH",
    installmentCount: 1,
    quoteVersion: unit.version,
    expectedTotalCents: unit.cashCents,
    receivedMethod: "",
  };
}

const MAX_CARD_FEE_PERCENT = 100;

export function BookReceiptTerms({
  terms,
  prices,
  change,
  allowAgreement = true,
}: {
  terms: ContractMaterialInput;
  prices: Prices;
  allowAgreement?: boolean;
  change: (terms: ContractMaterialInput) => void;
}): ReactElement {
  const id = useId();
  const methods = trpc.finance.paymentMethods.useQuery();
  const [error, setError] = useState("");
  const amount = bookQuote(terms, prices).charged;
  function update(next: ContractMaterialInput): void {
    try {
      const quote = bookQuote(next, prices);
      change({
        ...next,
        expectedTotalCents: quote.reference,
        receivedMethod: quote.charged === 0 ? undefined : (next.receivedMethod ?? ""),
      });
      setError("");
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : "Confira os valores do livro.");
    }
  }
  return (
    <>
      {amount > 0 && (
        <SelectControl
          name={id}
          label="Forma de pagamento"
          value={terms.receivedMethod ?? ""}
          choices={(methods.data ?? []).map((method) => ({
            value: method.code,
            label: method.name,
          }))}
          onChange={(code) => {
            const card = methods.data?.find(
              (method) => method.code === code,
            )?.allowsExternalInstallments;
            update({
              ...terms,
              receivedMethod: code,
              payment: card ? "INSTALLMENTS" : "CASH",
              installmentCount: 1,
              cardFeeOverridePct: undefined,
            });
          }}
        />
      )}
      {terms.payment === "INSTALLMENTS" && (
        <BookCardTerms id={id} terms={terms} prices={prices} update={update} />
      )}
      <p className="self-end text-sm">
        {amount > 0 ? "Valor pago" : "Bolsa integral"} · <strong>{money(amount)}</strong>
      </p>
      {allowAgreement && <BookAgreement terms={terms} change={update} />}
      {methods.isError && (
        <button type="button" onClick={() => void methods.refetch()}>
          Tentar carregar formas de pagamento
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </>
  );
}

function BookCardTerms({
  id,
  terms,
  prices,
  update,
}: {
  id: string;
  terms: ContractMaterialInput;
  prices: Prices;
  update: (terms: ContractMaterialInput) => void;
}): ReactElement {
  const manual = terms.quoteVersion === "AGREED_PRICE";
  return (
    <>
      {manual && (
        <label className="grid gap-1">
          Taxa do cartão (%)
          <input
            className="h-9 rounded-sm border border-input bg-field px-2"
            type="number"
            min="0"
            max="99.99"
            step="0.01"
            value={terms.cardFeeOverridePct ?? ""}
            onChange={(event) => {
              const rate = event.target.valueAsNumber;
              if (rate >= 0 && rate < MAX_CARD_FEE_PERCENT)
                update({ ...terms, cardFeeOverridePct: rate });
            }}
          />
        </label>
      )}
      <SelectControl
        name={id + "-parcelas"}
        label="Parcelas no cartão"
        value={String(terms.installmentCount)}
        choices={(manual
          ? Array.from({ length: 12 }, (_entry, index) => String(index + 1))
          : Object.keys(prices.cardFeeRates)
        )
          .toSorted((left, right) => Number(left) - Number(right))
          .map((count) => ({ value: count, label: count + "×" }))}
        onChange={(count) => update({ ...terms, installmentCount: Number(count) })}
      />
    </>
  );
}
