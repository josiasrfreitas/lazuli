import { InlineSkeleton } from "@lazuli/ui";
import styles from "./planning.module.css";
export function PlanningLoading() {
  return (
    <section className={styles.workspace} aria-busy="true" aria-label="Carregando planejamento">
      <div className={styles.context}>
        <div className="grid gap-2">
          <InlineSkeleton className="h-3 w-40" />
          <InlineSkeleton className="h-3 w-40" />
        </div>
        <InlineSkeleton className="h-4 w-36" />
      </div>
      <div className={styles.progress}>
        <div className="grid gap-2">
          <InlineSkeleton className="h-4 w-32" />
          <InlineSkeleton className="h-3 w-40" />
        </div>
        <div className={styles.meters}>
          {[0, 1].map((item) => (
            <div key={item} className="grid gap-2">
              <div className="flex justify-between">
                <InlineSkeleton className="h-3 w-24 max-w-full" />
                <InlineSkeleton className="h-3 w-12" />
              </div>
              <InlineSkeleton className="h-1.5 w-full" />
            </div>
          ))}
        </div>
        <InlineSkeleton className="h-3 w-32" />
      </div>
      <div className={styles.toolbar}>
        <InlineSkeleton className="h-4 w-56" />
        <InlineSkeleton className="h-7 w-36" />
      </div>
      <div className={styles.filters}>
        <InlineSkeleton className="h-4 w-64" />
        <InlineSkeleton className="h-7 w-56" />
      </div>
      <div aria-hidden="true">
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} className={styles.loadingRow}>
            <InlineSkeleton className="h-3 w-20" />
            <div className="grid gap-2">
              <InlineSkeleton className={row % 2 ? "h-3 w-48 max-w-full" : "h-3 w-64 max-w-full"} />
              <InlineSkeleton className="h-2 w-16" />
            </div>
            <InlineSkeleton className="h-3 w-24 max-w-full" />
          </div>
        ))}
      </div>
    </section>
  );
}
