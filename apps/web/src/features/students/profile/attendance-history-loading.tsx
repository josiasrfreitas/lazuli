import type { ReactElement } from "react";
import { InlineSkeleton } from "@lazuli/ui";
import styles from "./attendance-history-list.module.css";

/** Matches the compact date, time and attendance columns of the loaded list. */
export function AttendanceHistoryLoading(): ReactElement {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Carregando aulas e presenças</span>
      <ol className={styles.list} aria-hidden="true">
        {Array.from({ length: 8 }, (_value, row) => (
          <li key={row} className={styles.lesson}>
            <div className={styles.date}>
              <InlineSkeleton className="size-4 shrink-0 rounded-full" />
              <InlineSkeleton className="h-3 w-24 max-w-full" />
            </div>
            <div className={styles.hours}>
              <InlineSkeleton className="h-3 w-20 max-w-full" />
            </div>
            <div className={styles.status}>
              <InlineSkeleton className="h-6 w-24 max-w-full rounded-sm" />
            </div>
          </li>
        ))}
      </ol>
      <div className={styles.footer} aria-hidden="true">
        <InlineSkeleton className="h-3 w-16" />
      </div>
    </div>
  );
}
