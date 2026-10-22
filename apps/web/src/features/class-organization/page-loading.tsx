import type { JSX as ReactJSX } from "react";
import styles from "./organization.module.css";

export function OrganizationLoading(): ReactJSX.Element {
  return (
    <div className={styles.loading} role="status" aria-label="Carregando organização">
      <div className={styles.skeletonGrid}>
        {Array.from({ length: 35 }, (_unused, position) => (
          <span key={position} />
        ))}
      </div>
      <div className={styles.skeletonPanel}>
        {Array.from({ length: 9 }, (_unused, position) => (
          <span key={position} />
        ))}
      </div>
      <span className="sr-only">Carregando turmas e alunos…</span>
    </div>
  );
}
