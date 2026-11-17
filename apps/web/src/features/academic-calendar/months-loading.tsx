import type { ReactElement } from "react";
import { InlineSkeleton } from "@lazuli/ui";
import styles from "./workspace.module.css";

const MONTH_PLACEHOLDERS = 6;
const DAY_PLACEHOLDERS = 35;

export function CalendarMonthsLoading(): ReactElement {
  return (
    <div
      className={styles.months}
      role="status"
      aria-label="Carregando calendário"
      aria-busy="true"
    >
      {Array.from({ length: MONTH_PLACEHOLDERS }, (_unused, month) => (
        <div key={month} className={styles.month} aria-hidden="true">
          <div className={styles.monthHeading}>
            <InlineSkeleton shape="block" className="h-5 w-24" />
          </div>
          <div className={styles.weekdays}>
            {Array.from({ length: 7 }, (_unused, day) => (
              <InlineSkeleton key={day} shape="block" className="h-3 w-6" />
            ))}
          </div>
          <div className={styles.days}>
            {Array.from({ length: DAY_PLACEHOLDERS }, (_unused, day) => (
              <InlineSkeleton key={day} shape="block" className="h-6 w-full" />
            ))}
          </div>
          <div className={styles.monthFoot}>
            <InlineSkeleton className="h-3 w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}
