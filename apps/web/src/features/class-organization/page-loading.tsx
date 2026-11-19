import type { ReactElement } from "react";
import { InlineSkeleton } from "@lazuli/ui";
import { WeekHeader } from "./week-header";
import styles from "./formation.module.css";

export function FormationProgress({ label }: { label: string }): ReactElement {
  return (
    <div className={styles.progress} role="progressbar" aria-label={label}>
      <span />
    </div>
  );
}

export function OrganizationLoading({ review = false }: { review?: boolean }): ReactElement {
  if (review)
    return (
      <section className={styles.board} aria-label="Carregando vínculos" aria-busy="true">
        <FormationProgress label="Buscando os vínculos do semestre" />
        {Array.from({ length: 5 }, (_unused, index) => (
          <div
            key={index}
            aria-hidden="true"
            className="flex items-center gap-3 border-b border-border-subtle px-4 py-3"
          >
            <InlineSkeleton className="size-6 rounded-full" />
            <InlineSkeleton className="h-3 w-36" />
            <InlineSkeleton className="ml-auto h-3 w-24" />
          </div>
        ))}
      </section>
    );
  return (
    <div className={styles.workspace} aria-busy="true">
      <section className={styles.schedule} aria-label="Grade semanal">
        <table className={styles.week} aria-hidden="true">
          <WeekHeader day="MONDAY" />
        </table>
        <FormationProgress label="Buscando as turmas do período" />
      </section>
    </div>
  );
}
