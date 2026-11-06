import type { ReactElement } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@lazuli/ui";
import type { StudentFinanceSummary } from "@lazuli/domain";
import { StudentPayments } from "./student-payments";
import { FinanceHistoryDialog } from "./finance-history-dialog";
import styles from "./finance-details-dialog.module.css";

export function FinancePaymentHistory({
  summary,
  studentId,
  studentName,
  onPendingChange,
}: {
  summary: StudentFinanceSummary;
  studentId: string;
  studentName: string;
  onPendingChange: (pending: boolean) => void;
}): ReactElement {
  return (
    <div className={styles.history}>
      <div className={styles.historyHeading}>
        <h3>Recebimentos do aluno</h3>
        <p>Mais recentes primeiro · selecione para ver os comprovantes</p>
      </div>
      <StudentPayments studentId={studentId} onPendingChange={onPendingChange} />
      {summary.history.settledCount > 0 && <PaymentBehavior history={summary.history} />}
      <div className={styles.historyFooter}>
        <div className={styles.activityLink}>
          <FinanceHistoryDialog studentId={studentId} studentName={studentName} />
          <span>Atividades e tratativas</span>
        </div>
        <Button
          variant="link"
          size="inline"
          nativeButton={false}
          render={<Link href={`/recebiveis?aluno=${studentId}`} />}
        >
          Ver cobranças em Recebíveis <ArrowUpRight aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

function PaymentBehavior({ history }: { history: StudentFinanceSummary["history"] }): ReactElement {
  return (
    <details className={styles.behavior}>
      <summary>Análise de pontualidade · {behaviorLabel(history.paymentState)}</summary>
      <p>
        {history.settledCount === 0
          ? "A análise aparecerá após as primeiras quitações."
          : "Considera a data em que cada parcela foi totalmente quitada."}
      </p>
      {history.settledCount > 0 && (
        <dl>
          <BehaviorFact label="Em dia" value={String(history.onTimeCount)} />
          <BehaviorFact label="Com atraso" value={String(history.lateCount)} />
          <BehaviorFact
            label="Atraso médio"
            value={history.averageLateDays === null ? "—" : `${history.averageLateDays} dias`}
          />
        </dl>
      )}
    </details>
  );
}

function BehaviorFact({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function behaviorLabel(state: StudentFinanceSummary["history"]["paymentState"]): string {
  switch (state) {
    case "RECURRING_DELAY": {
      return "Atrasos recorrentes";
    }
    case "OCCASIONAL_DELAY": {
      return "Atraso pontual";
    }
    case "ON_TIME": {
      return "Pagamentos em dia";
    }
    case "INSUFFICIENT_HISTORY": {
      return "Histórico em formação";
    }
  }
}
