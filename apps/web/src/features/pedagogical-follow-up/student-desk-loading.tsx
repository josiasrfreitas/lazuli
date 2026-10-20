import type { ReactElement } from "react";
import { InlineSkeleton, Input } from "@lazuli/ui";
import { QueryLoading } from "~/components/query-loading";
import styles from "./student-desk.module.css";

export function DeskRowsLoading(): ReactElement {
  return (
    <div role="status" aria-label="Carregando registros" aria-busy="true">
      <span className="sr-only">Carregando registros…</span>
      {[0, 1, 2, 3].map((row) => (
        <div key={row} className={styles.recordButton} aria-hidden="true">
          <InlineSkeleton className="h-3.5 w-48 max-w-full rounded-sm" />
          <InlineSkeleton className="h-3 w-32 max-w-full rounded-sm" />
        </div>
      ))}
    </div>
  );
}

export function DeskDetailLoading(): ReactElement {
  return (
    <div className={styles.loadingDetail}>
      <QueryLoading label="Carregando registro" />
    </div>
  );
}

export function StudentDeskLoading({ selected = false }: { selected?: boolean }): ReactElement {
  return (
    <div className={styles.deskContainer}>
      <div className={styles.desk} data-selected={selected}>
        <aside className={styles.rail}>
          <div className={styles.railToolbar}>
            <div className="flex gap-4 py-2 text-sm">
              <span>Ocorrências</span>
              <span>Intervenções</span>
            </div>
            <Input
              size="sm"
              placeholder="Buscar ocorrência"
              aria-label="Buscar ocorrência"
              disabled
            />
          </div>
          <DeskRowsLoading />
        </aside>
        <section className={styles.detail}>
          <DeskDetailLoading />
        </section>
      </div>
    </div>
  );
}
