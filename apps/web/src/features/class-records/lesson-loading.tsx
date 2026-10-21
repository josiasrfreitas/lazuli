import type { ReactElement } from "react";
import { DialogDescription, DialogHeader, DialogTitle, InlineSkeleton } from "@lazuli/ui";
import styles from "./class-record-dialog.module.css";

export function LessonLoadingHeader(): ReactElement {
  return (
    <DialogHeader>
      <div className={styles.headingRow}>
        <DialogTitle className="text-base">Detalhes da aula</DialogTitle>
        <DialogDescription>
          <span className="sr-only">Carregando informações do encontro…</span>
          <InlineSkeleton className="h-3 w-48 max-w-full" />
        </DialogDescription>
      </div>
      <div className={styles.context} aria-hidden="true">
        {[0, 1].map((column) => (
          <div key={column}>
            <InlineSkeleton className="h-3 w-12" />
            <InlineSkeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
    </DialogHeader>
  );
}

const LOADING_ROWS = 4;

export function LessonLoadingList(): ReactElement {
  return (
    <div
      className={styles.attendance}
      role="status"
      aria-label="Carregando alunos e presença"
      aria-busy="true"
    >
      <span className="sr-only">Carregando alunos e presença…</span>
      <div aria-hidden="true">
        <div className={styles.listHeading}>
          <div className={styles.sectionHeading}>
            <h2>Alunos</h2>
            <InlineSkeleton className="h-3 w-24" />
          </div>
        </div>
        <div className={styles.roster}>
          {Array.from({ length: LOADING_ROWS }, (_value, row) => row).map((row) => (
            <div className={styles.loadingRow} key={row}>
              <span className={styles.person}>
                <InlineSkeleton className="size-8" />
                <span className={styles.student}>
                  <InlineSkeleton
                    className={row % 2 ? "h-3.5 w-36 max-w-full" : "h-3.5 w-44 max-w-full"}
                  />
                  <InlineSkeleton className="h-3 w-24 max-w-full" />
                </span>
              </span>
              <InlineSkeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
