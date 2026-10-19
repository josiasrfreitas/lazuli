import { InlineSkeleton } from "@lazuli/ui";
import styles from "./class-page.module.css";
export function ClassOverviewLoading() {
  return (
    <header className={styles.overview} aria-busy="true" aria-label="Carregando turma">
      <div className={styles.overviewGrid}>
        <div className={styles.identity}>
          <InlineSkeleton className="h-9 w-48 max-w-full" />
          <InlineSkeleton className="h-4 w-32" />
          <InlineSkeleton className="h-3 w-40" />
          <InlineSkeleton className="h-4 w-36" />
        </div>
        <div className={styles.schedule}>
          <InlineSkeleton className="h-3 w-24" />
          <div className="mt-4 grid gap-3">
            <InlineSkeleton className="h-5 w-36" />
            <InlineSkeleton className="h-4 w-40" />
          </div>
        </div>
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className={`${styles.occupancy} ${item === 2 ? styles.stageProgress : ""}`}
          >
            <InlineSkeleton className="h-3 w-24 max-w-full" />
            <InlineSkeleton className="h-7 w-20" />
            <InlineSkeleton className="h-3 w-28 max-w-full" />
          </div>
        ))}
      </div>
    </header>
  );
}
