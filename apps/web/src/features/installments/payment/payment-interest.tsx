import type { ReactElement } from "react";
import { formatBRLFromCents as money, formatDateOnlyBR } from "~/lib/format";
import type { PaymentFormState } from "./logic";
import type { PreviewRow } from "./draft";

type InterestDetails = NonNullable<NonNullable<PreviewRow["line"]>["interestDetails"]>;
export function PaymentInterest({ state }: { state: PaymentFormState }): ReactElement {
  const rows = state.preview.filter((row) => row.line?.interestDetails);
  return (
    <div className="grid gap-2 text-caption text-muted-foreground">
      {rows.map((row) => {
        const details = row.line!.interestDetails!;
        const chargedDays = details.periods.reduce((sum, period) => sum + period.days, 0);
        const item = state.draft.items.find(
          (entry) => entry.row.installmentId === row.installmentId,
        );
        return (
          <div key={row.installmentId} className="grid gap-1">
            {rows.length > 1 && (
              <p className="font-medium text-foreground">
                {item?.row.beneficiaries.map((person) => person.fullName).join(", ") ||
                  item?.row.payer.name}
                {" · Parcela "}
                {item?.row.sequenceNumber}
              </p>
            )}
            {item && (
              <p className="font-numeric font-semibold text-foreground">
                Vencimento {formatDateOnlyBR(item.row.dueDate)}
              </p>
            )}
            <p>
              <span className="font-medium text-destructive">
                {chargedDays === details.overdueDays
                  ? `${chargedDays} dias de atraso`
                  : `${chargedDays} dias com juros`}
              </span>
              {" · "}
              {details.monthlyPct.toLocaleString("pt-BR")}% ao mês
            </p>
            {details.periods.length === 1 ? (
              <InterestPeriods details={details} />
            ) : (
              <details>
                <summary className="cursor-pointer">
                  Ver {details.periods.length} períodos de cálculo
                </summary>
                <InterestPeriods details={details} />
              </details>
            )}
            {details.postedInterestCents > 0 && (
              <p>
                Acumulado {money(details.accruedInterestCents)} − já lançado{" "}
                {money(details.postedInterestCents)}
                {" = "}
                <span className="font-numeric text-foreground">
                  {money(row.line!.quote.newInterestCents)} novos
                </span>
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function InterestPeriods({ details }: { details: InterestDetails }): ReactElement {
  return (
    <div className="grid gap-2">
      {details.periods.map((period) => (
        <div key={`${period.from}-${period.through}`}>
          <p>
            {formatDateOnlyBR(period.from)} a {formatDateOnlyBR(period.through)} · sobre{" "}
            {money(period.principalCents)}
          </p>
        </div>
      ))}
    </div>
  );
}
