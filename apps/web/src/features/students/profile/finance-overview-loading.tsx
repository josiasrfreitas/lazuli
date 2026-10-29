import type { ReactElement } from "react";
import { InlineSkeleton } from "@lazuli/ui";
import styles from "./finance-overview.module.css";
import loading from "./student-loading.module.css";

/** Keep the same compact summary in place while balances arrive. */
export function FinanceOverviewLoading(): ReactElement {
  return (
    <section
      className={`${styles.overview} ${loading.surface}`}
      aria-label="Carregando resumo financeiro"
      aria-busy="true"
    >
      <div className={styles.heading} aria-hidden="true">
        <div className="grid gap-2">
          <InlineSkeleton className="h-7 w-40" />
          <InlineSkeleton className="h-3 w-64 max-w-full" />
        </div>
        <div className="flex gap-2">
          <InlineSkeleton className="h-8 w-36" />
          <InlineSkeleton className="h-8 w-40" />
        </div>
      </div>
      <div className={styles.overviewFacts} aria-hidden="true">
        <div className={styles.essentials}>
          {[0, 1, 2].map((item) => (
            <div key={item}>
              <InlineSkeleton className="h-3 w-28" />
              <InlineSkeleton className="h-9 w-32 max-w-full" />
              <InlineSkeleton className="h-3 w-40 max-w-full" />
            </div>
          ))}
        </div>
        <div className={styles.contractDates}>
          <div className={styles.contractDatesRow}>
            {[0, 1, 2].map((item) => (
              <div key={item}>
                <InlineSkeleton className="h-3 w-24" />
                <InlineSkeleton className="h-4 w-36 max-w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
