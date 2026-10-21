import type { ReactNode } from "react";
import { InlineSkeleton } from "@lazuli/ui";
import styles from "./catalog.module.css";
import mapStyles from "./program-map.module.css";

export function ProgramLoading(): ReactNode {
  return (
    <div className={mapStyles.map} aria-label="Carregando programação" aria-busy="true">
      <div className={mapStyles.unitHeader}>
        <InlineSkeleton className="h-5 w-32" />
      </div>
      <div className={mapStyles.blocks}>
        {Array.from({ length: 8 }, (_entry, index) => (
          <div key={index} className={mapStyles.block}>
            <InlineSkeleton className="h-3 w-24" />
            <InlineSkeleton className="h-5 w-32" />
            <InlineSkeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
export function StageLoading(): ReactNode {
  return (
    <section className={styles.detail} aria-label="Carregando estágio" aria-busy="true">
      <header className={styles.detailHeader}>
        <div className="grid gap-3">
          <InlineSkeleton className="h-6 w-40" />
          <InlineSkeleton className="h-3 w-56" />
        </div>
      </header>
      <div className={styles.detailBody}>
        <ProgramLoading />
      </div>
    </section>
  );
}
