import type { ReactElement } from "react";
import { InlineSkeleton } from "@lazuli/ui";
import styles from "./class-lessons.module.css";
import loadingStyles from "./class-lessons-loading.module.css";
import attendanceStyles from "~/features/class-records/class-record-dialog.module.css";
import panelStyles from "./class-panel.module.css";

const PLACEHOLDER_ROW_COUNT = 6;
const PLACEHOLDER_ROWS = Array.from({ length: PLACEHOLDER_ROW_COUNT }, (_unused, index) => index);

export function ClassLessonsLoading(): ReactElement {
  return (
    <div id="aulas-da-turma" className={styles.container}>
      <div className={`dark ${panelStyles.surface} ${styles.desk}`} data-show-list="false">
        <div className={`${styles.rail} ${styles.loadingRail}`} aria-hidden="true">
          <div className={styles.railHeading}>
            <InlineSkeleton className="h-4 w-20" />
            <p>
              <InlineSkeleton className="h-3 w-32" />
            </p>
          </div>
          <div className={styles.list}>
            {PLACEHOLDER_ROWS.map((row) => (
              <div key={row} className={styles.lesson}>
                <InlineSkeleton className="h-4 w-24" />
                <InlineSkeleton className="h-3 w-20" />
                <InlineSkeleton className="h-3 w-36" />
                <InlineSkeleton className="h-3 w-32" />
              </div>
            ))}
          </div>
        </div>
        <div className={styles.detail}>
          <div className={styles.detailBody}>
            <LessonPresenceLoading />
          </div>
        </div>
      </div>
    </div>
  );
}

export function LessonPresenceLoading({
  label = "Carregando alunos e registro da aula…",
  empty = false,
}: { label?: string; empty?: boolean } = {}): ReactElement {
  if (empty) return <EmptyLessonLoading label={label} />;
  return (
    <div className={loadingStyles.surface} role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      <div className={attendanceStyles.attendance} aria-hidden="true">
        <div className={attendanceStyles.listHeading} data-compact="true">
          <div className={attendanceStyles.sectionHeading}>
            <InlineSkeleton className="h-4 w-24" />
            <InlineSkeleton className="h-3 w-32" />
          </div>
          <div className={attendanceStyles.listControls}>
            <InlineSkeleton shape="block" className="h-8 w-full" />
          </div>
        </div>
        <div className={styles.contentRecord}>
          <InlineSkeleton className="h-4 w-40" />
          <InlineSkeleton className="h-3 w-64 max-w-full" />
        </div>
        <ul className={attendanceStyles.roster}>
          {PLACEHOLDER_ROWS.map((row) => (
            <li key={row}>
              <div className={attendanceStyles.loadingRow}>
                <div className={attendanceStyles.person}>
                  <InlineSkeleton className="size-8 shrink-0" />
                  <div className={loadingStyles.identity}>
                    <InlineSkeleton
                      className={row % 2 ? "h-3 w-32 max-w-full" : "h-3 w-40 max-w-full"}
                    />
                    <InlineSkeleton className="h-3 w-20" />
                  </div>
                </div>
                <InlineSkeleton className="h-3 w-16" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function EmptyLessonLoading({ label }: { label: string }): ReactElement {
  return (
    <div className={`${loadingStyles.surface} ${styles.unrecorded}`} role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      <InlineSkeleton shape="block" className="size-10" />
      <InlineSkeleton className="h-5 w-40" />
      <InlineSkeleton className="h-4 w-64 max-w-full" />
    </div>
  );
}
