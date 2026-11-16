import type { ReactElement } from "react";
import { InlineSkeleton } from "@lazuli/ui";
import styles from "./teacher-students.module.css";
export function TeacherStudentsLoading(): ReactElement {
  return (
    <div className={styles.students} aria-busy="true" aria-label="Carregando alunos">
      {Array.from({ length: 6 }, (_empty, index) => (
        <div key={index} className={styles.student}>
          <InlineSkeleton className="h-6 w-48 max-w-full" />
          <InlineSkeleton className="h-4 w-32" />
          <InlineSkeleton className="h-10 w-full" />
        </div>
      ))}
    </div>
  );
}
