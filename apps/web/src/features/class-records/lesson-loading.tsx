import { DialogDescription, DialogHeader, DialogTitle, InlineSkeleton } from "@lazuli/ui";
import styles from "./class-record-dialog.module.css";

export function LessonLoadingHeader() {
  return (
    <DialogHeader>
      <DialogTitle>Detalhes da aula</DialogTitle>
      <DialogDescription>Carregando informações do encontro…</DialogDescription>
      <div className={styles.context} aria-hidden="true">
        {[0, 1].map((column) => (
          <div className={styles.loadingFact} key={column}>
            <InlineSkeleton className="h-3 w-20" />
            <InlineSkeleton className="h-4 w-40" />
            <InlineSkeleton className="h-3 w-28" />
          </div>
        ))}
      </div>
    </DialogHeader>
  );
}

export function LessonLoadingList() {
  return (
    <div className={styles.attendance} role="status" aria-label="Carregando alunos e presença">
      <span className="sr-only">Carregando alunos e presença…</span>
      <div aria-hidden="true">
        <div className={styles.listHeading}>
          <div className={styles.sectionHeading}>
            <h2>Alunos</h2>
            <InlineSkeleton className="h-3 w-36" />
          </div>
        </div>
        <div className={styles.roster}>
          {[0, 1, 2, 3, 4, 5].map((row) => (
            <div className={styles.loadingRow} key={row}>
              <span className={styles.person}>
                <InlineSkeleton className="size-8" />
                <span className={styles.student}>
                  <InlineSkeleton className={row % 2 ? "h-4 w-36" : "h-4 w-44"} />
                  <InlineSkeleton className="h-3 w-24" />
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
