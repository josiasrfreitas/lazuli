import type { ReactElement } from "react";
import { InlineSkeleton } from "@lazuli/ui";
import styles from "./planning.module.css";
export function PlanningLoading(): ReactElement {
  return (
    <section
      className={styles.workspace}
      role="status"
      aria-busy="true"
      aria-label="Carregando planejamento"
    >
      <span className="sr-only">Carregando planejamento…</span>
      <div className={styles.context}>
        <div className="grid gap-2">
          <InlineSkeleton className="h-4 w-40 max-w-full" />
          <InlineSkeleton className="h-3 w-40 max-w-full" />
        </div>
        <InlineSkeleton className="h-3 w-36 max-w-full" />
      </div>
      <div className={styles.progress}>
        <InlineSkeleton className="h-4 w-32 max-w-full" />
        <InlineSkeleton className="h-8 w-full" />
      </div>
      <div className={styles.toolbar}>
        <InlineSkeleton className="h-4 w-56 max-w-full" />
        <InlineSkeleton className="h-8 w-36 max-w-full" />
      </div>
      <div className={styles.filters}>
        <InlineSkeleton className="h-4 w-64 max-w-full" />
        <InlineSkeleton className="h-8 w-56 max-w-full" />
      </div>
      <div aria-hidden="true">
        {[0, 1, 2].map((row) => (
          <div key={row} className={styles.loadingRow}>
            <InlineSkeleton className="h-3 w-20 max-w-full" />
            <div className="grid min-w-0 gap-2">
              <InlineSkeleton className={row % 2 ? "h-3 w-48 max-w-full" : "h-3 w-64 max-w-full"} />
              <InlineSkeleton className="h-2 w-16 max-w-full" />
            </div>
            <InlineSkeleton className="h-3 w-24 max-w-full" />
          </div>
        ))}
      </div>
    </section>
  );
}
