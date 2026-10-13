import type { ReactElement } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { FileText } from "lucide-react";
import { formatBRLFromCents as money, formatDateOnlyBR } from "~/lib/format";

type Summary = RouterOutputs["finance"]["studentSummary"];
type Contract = Summary["contracts"][number];

export function FinanceContractTerms({ summary }: { summary: Summary }): ReactElement | null {
  const current = summary.contracts.filter(
    (row) =>
      row.startsOn && row.endsOn && row.startsOn <= summary.asOf && row.endsOn >= summary.asOf,
  );
  const visible = current.length ? current : summary.contracts.slice(0, 1);
  if (!visible.length) return null;
  return (
    <div className="grid gap-2">
      {visible.map((contract) => (
        <div
          key={contract.id}
          className="flex items-start gap-2 text-caption text-muted-foreground"
        >
          <FileText className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <p>
            <span className="font-medium text-foreground">{contractLabel(contract)}</span>
            {contract.schedules.map((schedule) => (
              <span key={schedule.id}>
                {" "}
                ·{" "}
                {schedule.installmentCount === 1
                  ? "À vista"
                  : `${schedule.installmentCount} parcelas`}
                {schedule.uniformAmountCents !== null
                  ? ` de ${money(schedule.uniformAmountCents)}`
                  : " com valores variáveis"}{" "}
                · vencimento dia {schedule.dueDay}
              </span>
            ))}
            {contract.startsOn && contract.endsOn && (
              <span>
                {" "}
                · {formatDateOnlyBR(contract.startsOn)} a {formatDateOnlyBR(contract.endsOn)}
              </span>
            )}
            {contract.punctualityDiscountPct > 0 && (
              <span>
                {" "}
                · {new Intl.NumberFormat("pt-BR").format(contract.punctualityDiscountPct)}% de
                desconto por pontualidade
              </span>
            )}
          </p>
        </div>
      ))}
    </div>
  );
}
function contractLabel(contract: Contract): string {
  if (contract.durationMonths === 12) return "Contrato anual";
  if (contract.durationMonths) return `Contrato de ${contract.durationMonths} meses`;
  return "Contrato";
}
