import type { ReactElement } from "react";
import { InlineSkeleton } from "@lazuli/ui";
import styles from "./teacher-overview.module.css";

/** Match the report geometry so resolved data does not shift the card's layout. */
export function TeacherOccurrenceLoading(): ReactElement {
  return (
    <>
      <div className={styles.occurrenceTotals} aria-hidden="true">
        <InlineSkeleton className="w-24" />
        <InlineSkeleton className="w-28" />
      </div>
      <div className={styles.occurrenceSlide} aria-hidden="true">
        <div className={styles.occurrenceStudent}>
          <InlineSkeleton className="size-8" />
          <div>
            <InlineSkeleton shape="block" className="h-4 w-40 max-w-full" />
            <InlineSkeleton className="w-28" />
          </div>
          <InlineSkeleton shape="block" className="h-5 w-16" />
        </div>
        <div className={styles.occurrenceReport}>
          <InlineSkeleton className="w-24" />
          <div className={styles.reportLoading}>
            <InlineSkeleton shape="block" className="h-5 w-3/5" />
            <div className={styles.loadingLines}>
              <InlineSkeleton className="w-full" />
              <InlineSkeleton className="w-5/6" />
              <InlineSkeleton className="w-2/3" />
            </div>
          </div>
          <InlineSkeleton className="w-36" />
        </div>
      </div>
      <div className={styles.occurrenceFooter} aria-hidden="true">
        <InlineSkeleton className="w-20" />
        <div className={styles.occurrenceControls}>
          <InlineSkeleton className="w-10" />
          <InlineSkeleton shape="block" className="size-4" />
          <InlineSkeleton shape="block" className="size-4" />
        </div>
      </div>
    </>
  );
}

export function TeacherHealthContextLoading(): ReactElement {
  return (
    <div className={styles.healthContext} aria-hidden="true">
      <InlineSkeleton className="w-40" />
      <div className={styles.healthFocusList}>
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className={styles.healthFocus}>
            <InlineSkeleton className="size-6" />
            <InlineSkeleton shape="block" className="h-5 w-10 justify-self-end" />
            <div className={styles.healthFocusName}>
              <InlineSkeleton className="w-full" />
              <InlineSkeleton className="w-2/3" />
            </div>
          </div>
        ))}
      </div>
      <InlineSkeleton className="w-5/6" />
    </div>
  );
}
