import type { JSX as ReactJSX } from "react";
import { DialogDescription, DialogHeader, DialogTitle, InlineSkeleton } from "@lazuli/ui";
import styles from "./class-record-dialog.module.css";

const SKELETON_ROW_COUNT = 4;

export function LessonLoadingHeader(): ReactJSX.Element {
  return (
    <DialogHeader>
      <div className={styles.headingRow}>
        <DialogTitle className="text-base">Detalhes da aula</DialogTitle>
        <DialogDescription>
          <span className="sr-only">Carregando informações do encontro…</span>
          <InlineSkeleton className="h-3 w-48 max-w-full rounded-sm" />
        </DialogDescription>
      </div>
      <div className={styles.context} aria-hidden="true">
        {[0, 1].map((column) => (
          <div key={column}>
            <InlineSkeleton className="h-3 w-12 rounded-sm" />
            <InlineSkeleton className="h-3 w-32 rounded-sm" />
          </div>
        ))}
      </div>
    </DialogHeader>
  );
}

export function LessonLoadingList(): ReactJSX.Element {
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
            <InlineSkeleton className="h-3 w-24 rounded-sm" />
          </div>
        </div>
        <div className={styles.roster}>
          {Array.from({ length: SKELETON_ROW_COUNT }, (_unused, index) => index).map((row) => (
            <div className={styles.loadingRow} key={row}>
              <span className={styles.person}>
                <InlineSkeleton className="size-8" />
                <span className={styles.student}>
                  <InlineSkeleton
                    className={
                      row % 2
                        ? "h-3.5 w-36 max-w-full rounded-sm"
                        : "h-3.5 w-44 max-w-full rounded-sm"
                    }
                  />
                  <InlineSkeleton className="h-3 w-24 max-w-full rounded-sm" />
                </span>
              </span>
              <InlineSkeleton className="h-3 w-20 rounded-sm" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
