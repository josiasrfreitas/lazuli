import type { ReactElement } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { visibleFinanceContracts } from "./finance-contract-terms";
import styles from "./finance-overview.module.css";

type Summary = RouterOutputs["finance"]["studentSummary"];
const NOT_INFORMED = "Não informado";
const FULL_SCHOLARSHIP_PCT = 100;
const monthYear = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function formatMonthYear(date: string): string {
  const formatted = monthYear.format(new Date(`${date}T00:00:00Z`));
  return formatted.charAt(0).toLocaleUpperCase("pt-BR") + formatted.slice(1);
}

export function FinanceContractDates({ summary }: { summary: Summary }): ReactElement | null {
  const contracts = visibleFinanceContracts(summary);
  if (contracts.length === 0) return null;
  return (
    <div className={styles.contractDates}>
      {contracts.map((contract) => {
        const tuition = contract.schedules.find((schedule) => schedule.kind === "TUITION");
        let monthlyDue = tuition?.dueDay ? `Todo dia ${tuition.dueDay}` : NOT_INFORMED;
        if (contract.scholarshipPct === FULL_SCHOLARSHIP_PCT)
          monthlyDue = "Bolsa integral · sem cobrança";
        return (
          <dl key={contract.id} aria-label="Datas do contrato" className={styles.contractDatesRow}>
            <div>
              <dt>Início do contrato</dt>
              <dd>{contract.startsOn ? formatMonthYear(contract.startsOn) : NOT_INFORMED}</dd>
            </div>
            <div>
              <dt>Término do contrato</dt>
              <dd>{contract.endsOn ? formatMonthYear(contract.endsOn) : NOT_INFORMED}</dd>
            </div>
            <div>
              <dt>Vencimento mensal</dt>
              <dd className={styles.dueValue}>{monthlyDue}</dd>
            </div>
          </dl>
        );
      })}
    </div>
  );
}
