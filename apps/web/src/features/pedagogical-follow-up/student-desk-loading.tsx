import type { ReactElement } from "react";
import { InlineSkeleton, Input, PencilLoader } from "@lazuli/ui";
import styles from "./student-desk.module.css";

export function DeskRowsLoading(): ReactElement {
  return (
    <div role="status" aria-label="Carregando registros">
      {[0, 1, 2, 3, 4, 5].map((row) => (
        <div key={row} className="grid gap-2 border-b border-border px-3 py-4" aria-hidden="true">
          <InlineSkeleton className="h-4 w-48 max-w-full" />
          <InlineSkeleton className="h-3 w-32 max-w-full" />
          <InlineSkeleton className="h-3 w-24 max-w-full" />
        </div>
      ))}
    </div>
  );
}

export function DeskDetailLoading(): ReactElement {
  return <div className={styles.loadingDetail}><PencilLoader label="Carregando registro" /></div>;
}

export function StudentDeskLoading(): ReactElement {
  return (
    <div className={styles.deskContainer}>
      <div className={styles.desk} data-selected={false}>
        <aside className={styles.rail}>
          <div className={styles.railToolbar}>
            <div className="flex gap-4 py-2 text-sm"><span>Ocorrências</span><span>Intervenções</span></div>
            <Input size="sm" placeholder="Buscar ocorrência" aria-label="Buscar ocorrência" disabled />
          </div>
          <DeskRowsLoading />
        </aside>
        <section className={styles.detail}><DeskDetailLoading /></section>
      </div>
    </div>
  );
}
