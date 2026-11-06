import type { ReactElement } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { formatBRLFromCents as money } from "~/lib/format";
import { ContractInvoice } from "./contract-invoice";

const ANNUAL_CONTRACT_MONTHS = 12;
type Summary = RouterOutputs["finance"]["studentSummary"];
type Contract = Summary["contracts"][number];

export function FinanceContractTerms({ summary }: { summary: Summary }): ReactElement {
  const visible = visibleFinanceContracts(summary);
  return (
    <div className="grid min-w-0 gap-5">
      {visible.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum contrato para exibir.</p>
      )}
      {visible.map((contract) => (
        <ContractDetails key={contract.id} contract={contract} />
      ))}
    </div>
  );
}

function ContractDetails({ contract }: { contract: Contract }): ReactElement {
  return (
    <section className="min-w-0" aria-label={contractLabel(contract)}>
      <ContractDetailsHeading contract={contract} />
      <ContractInvoice contract={contract} />
    </section>
  );
}

function ContractDetailsHeading({ contract }: { contract: Contract }): ReactElement {
  return (
    <>
      <h3 className="text-sm font-semibold text-heading">{contractLabel(contract)}</h3>
      {contract.renegotiations?.[0] && (
        <p className="mt-1 text-caption text-muted-foreground">
          Último acordo: {contract.renegotiations[0].installmentCount} parcela(s) a{" "}
          {money(contract.renegotiations[0].newAmountCents)}
        </p>
      )}
    </>
  );
}

function contractLabel(contract: Contract): string {
  if (contract.durationMonths === ANNUAL_CONTRACT_MONTHS) return "Contrato anual";
  if (contract.durationMonths)
    return `Contrato de ${contract.durationMonths} ${contract.durationMonths === 1 ? "mês" : "meses"}`;
  return "Contrato";
}
export function visibleFinanceContracts(summary: Summary): Contract[] {
  const current = summary.contracts.filter(
    (row) =>
      row.startsOn && row.endsOn && row.startsOn <= summary.asOf && row.endsOn >= summary.asOf,
  );
  return current.length > 0 ? current : summary.contracts.slice(0, 1);
}
