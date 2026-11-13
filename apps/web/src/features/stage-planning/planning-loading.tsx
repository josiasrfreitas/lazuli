import type { ReactElement } from "react";
import { InlineSkeleton } from "@lazuli/ui";
import styles from "./journey.module.css";
export function PlanningLoading(): ReactElement {
  return (
    <section
      className={styles.workspace}
      role="status"
      aria-busy="true"
      aria-label="Carregando planejamento"
    >
      <span className="sr-only">Carregando planejamento…</span>
      <InlineSkeleton className="h-5 w-56 max-w-full rounded-sm" />
      <div className={styles.outlook} aria-hidden="true">
        <InlineSkeleton className="h-4 w-40 max-w-full rounded-sm" />
        <div className={styles.outlookBody}>
          <div className="grid gap-3">
            <InlineSkeleton className="h-4 w-28 max-w-full rounded-sm" />
            <InlineSkeleton className="h-8 w-72 max-w-full rounded-sm" />
            <InlineSkeleton className="h-4 w-64 max-w-full rounded-sm" />
          </div>
          <div className="grid gap-5">
            {[0, 1].map((i) => (
              <div key={i} className="grid gap-2">
                <InlineSkeleton className="h-4 w-40 max-w-full rounded-sm" />
                <InlineSkeleton className="h-1.5 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className={styles.content} aria-hidden="true">
        <InlineSkeleton className="h-4 w-40 max-w-full rounded-sm" />
        <div className={styles.moments}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="grid gap-3">
              <InlineSkeleton className="h-3 w-24 max-w-full rounded-sm" />
              <InlineSkeleton className="h-5 w-40 max-w-full rounded-sm" />
              <InlineSkeleton className="h-3 w-48 max-w-full rounded-sm" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
