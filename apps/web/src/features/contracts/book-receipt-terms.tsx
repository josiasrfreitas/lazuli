"use client";
import { useId, useState } from "react";
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

export function BookReceiptTerms({
  terms,
  prices,
  change,
}: {
  terms: ContractMaterialInput;
  prices: Prices;
  change: (terms: ContractMaterialInput) => void;
}) {
  const id = useId();
  const methods = trpc.finance.paymentMethods.useQuery();
  const [error, setError] = useState("");
  const amount = bookQuote(terms, prices).charged;
  function update(next: ContractMaterialInput) {
    try {
      const quote = bookQuote(next, prices);
      change({
        ...next,
        expectedTotalCents: quote.reference,
        receivedMethod: quote.charged === 0 ? undefined : (next.receivedMethod ?? ""),
      });
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Confira os valores do livro.");
    }
  }
  return (
    <>
      {amount > 0 && (
        <SelectControl
          name={id}
          label="Forma de pagamento"
          value={terms.receivedMethod ?? ""}
          choices={(methods.data ?? []).map((m) => ({ value: m.code, label: m.name }))}
          onChange={(code) => {
            const card = methods.data?.find((m) => m.code === code)?.allowsExternalInstallments;
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
        <SelectControl
          name={id + "-parcelas"}
          label="Parcelas no cartão"
          value={String(terms.installmentCount)}
          choices={Object.keys(prices.cardFeeRates)
            .sort((a, b) => Number(a) - Number(b))
            .map((n) => ({ value: n, label: n + "×" }))}
          onChange={(n) => update({ ...terms, installmentCount: Number(n) })}
        />
      )}
      <p className="self-end text-sm">
        {amount > 0 ? "Valor pago" : "Bolsa integral"} · <strong>{money(amount)}</strong>
      </p>
      <BookAgreement terms={terms} change={update} />
      {methods.isError && (
        <button type="button" onClick={() => void methods.refetch()}>
          Tentar carregar formas de pagamento
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </>
  );
}
