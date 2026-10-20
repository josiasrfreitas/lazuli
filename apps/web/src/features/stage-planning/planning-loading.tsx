import { InlineSkeleton } from "@lazuli/ui";
import styles from "./planning.module.css";
export function PlanningLoading() {
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
          <InlineSkeleton className="h-4 w-40 max-w-full rounded-sm" />
          <InlineSkeleton className="h-3 w-40 max-w-full rounded-sm" />
        </div>
        <InlineSkeleton className="h-3 w-36 max-w-full rounded-sm" />
      </div>
      <div className={styles.progress}>
        <div className="grid gap-2">
          <InlineSkeleton className="h-4 w-32 max-w-full rounded-sm" />
          <InlineSkeleton className="h-3 w-40 max-w-full rounded-sm" />
        </div>
        <div className={styles.meters}>
          {[0, 1].map((item) => (
            <div key={item} className="grid gap-2">
              <div className="flex justify-between gap-3">
                <InlineSkeleton className="h-3 w-24 min-w-0 shrink rounded-sm" />
                <InlineSkeleton className="h-3 w-12 rounded-sm" />
              </div>
              <InlineSkeleton className="h-1.5 w-full" />
            </div>
          ))}
        </div>
        <InlineSkeleton className="h-3 w-32 max-w-full rounded-sm" />
      </div>
      <div className={styles.toolbar}>
        <InlineSkeleton className="h-4 w-56 max-w-full rounded-sm" />
        <InlineSkeleton className="h-8 w-36 max-w-full rounded-md" />
      </div>
      <div className={styles.filters}>
        <InlineSkeleton className="h-4 w-64 max-w-full rounded-sm" />
        <InlineSkeleton className="h-8 w-56 max-w-full rounded-md" />
      </div>
      <div aria-hidden="true">
        {[0, 1, 2].map((row) => (
          <div key={row} className={styles.loadingRow}>
            <InlineSkeleton className="h-3 w-20 max-w-full rounded-sm" />
            <div className="grid min-w-0 gap-2">
              <InlineSkeleton
                className={
                  row % 2 ? "h-3 w-48 max-w-full rounded-sm" : "h-3 w-64 max-w-full rounded-sm"
                }
              />
              <InlineSkeleton className="h-2 w-16 max-w-full rounded-sm" />
            </div>
            <InlineSkeleton className="h-3 w-24 max-w-full rounded-sm" />
          </div>
        ))}
      </div>
    </section>
  );
}
