import type { ReactElement } from "react";
import { WeekHeader } from "./week-header";
import styles from "./formation.module.css";

export function FormationProgress({ label }: { label: string }): ReactElement {
  return (
    <div className={styles.progress} role="progressbar" aria-label={label}>
      <span />
    </div>
  );
}

export function OrganizationLoading(): ReactElement {
  return (
    <div className={styles.workspace} data-mobile="grade" aria-busy="true">
      <section className={styles.schedule} aria-label="Grade semanal">
        <table className={styles.week} aria-hidden="true">
          <WeekHeader day="MONDAY" />
        </table>
        <FormationProgress label="Buscando as turmas do período" />
      </section>
      <aside className={styles.panel}>
        <div className={styles.panelTitle}>
          <h2>Pendências</h2>
        </div>
      </aside>
    </div>
  );
}
