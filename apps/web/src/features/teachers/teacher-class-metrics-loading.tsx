import type { ReactElement } from "react";
import { InlineSkeleton } from "@lazuli/ui";
import styles from "./teacher-class-metrics.module.css";

export function TeacherClassMetricsLoading(): ReactElement {
  return (
    <div className={styles.grid} aria-busy="true" aria-label="Carregando indicadores das turmas">
      {Array.from({ length: 2 }, (_, index) => (
        <div key={index} className={styles.card} aria-hidden="true">
          <InlineSkeleton shape="block" className="h-5 w-40" />
          <InlineSkeleton className="w-28" />
          <div className={styles.metrics}>
            {Array.from({ length: 3 }, (_, metric) => (
              <div key={metric} className={styles.loadingMetric}>
                <InlineSkeleton className="w-20 max-w-full" />
                <InlineSkeleton shape="block" className="h-7 w-12" />
                <InlineSkeleton className="w-24 max-w-full" />
              </div>
            ))}
          </div>
          <div className={styles.calls}>
            <InlineSkeleton className="w-32" />
            <InlineSkeleton className="w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}
