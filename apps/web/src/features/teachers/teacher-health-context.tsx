import { TeacherHealthStudent } from "./teacher-health-student";
import type { ReactElement } from "react";
import { Check } from "lucide-react";
import type { RouterOutputs } from "@lazuli/api";
import { TeacherHealthContextLoading } from "./teacher-metric-loading";
import styles from "./teacher-overview.module.css";

export function TeacherHealthContext({
  data,
}: {
  data: RouterOutputs["teachers"]["metrics"] | undefined;
}): ReactElement {
  if (!data) return <TeacherHealthContextLoading />;
  const flagged = data.students
    .filter((student) => student.level === "ATTENTION" || student.level === "PRIORITY")
    .toSorted((a, b) => (a.score ?? 0) - (b.score ?? 0) || a.name.localeCompare(b.name, "pt-BR"))
    .slice(0, 3);
  const highlightedIds = new Set(flagged.map((student) => student.id));
  const highest = data.students
    .filter((student) => student.score !== null && !highlightedIds.has(student.id))
    .toSorted((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.name.localeCompare(b.name, "pt-BR"))
    .slice(0, 3);
  const partial = data.students.filter(
    (student) => student.score !== null && student.availableIndicators < 4,
  ).length;
  const missing = data.studentCount - data.coveredStudents;
  return (
    <div className={styles.healthContext}>
      {[
        { title: "Para acompanhar de perto", students: flagged },
        { title: "Maiores scores", students: highest },
      ].map(({ title, students }) =>
        students.length > 0 ? (
          <section key={title} className={styles.healthContext} aria-label={title}>
            <h3 className={styles.healthFocusHeading}>{title}</h3>
            <ul className={styles.healthFocusList}>
              {students.map((student) => (
                <TeacherHealthStudent key={student.id} student={student} />
              ))}
              {Array.from({ length: 3 - students.length }, (_, index) => (
                <li key={`empty-${index}`} className={styles.healthFocusEmpty} aria-hidden="true" />
              ))}
            </ul>
          </section>
        ) : null,
      )}
      {flagged.length === 0 && (
        <p className={styles.healthClear}>
          <Check aria-hidden="true" />
          {data.coveredStudents > 0
            ? "Nenhum aluno com score em atenção ou prioridade."
            : "Ainda não há scores para acompanhar."}
        </p>
      )}
      <p className={styles.healthCoverage}>
        {missing > 0 ? `${missing} sem dados suficientes. ` : ""}
        {partial > 0
          ? `${partial} ${partial === 1 ? "aluno com indicadores parciais" : "alunos com indicadores parciais"}. Dados ausentes não viram zero.`
          : data.coveredStudents > 0
            ? "Os alunos avaliados têm os quatro indicadores disponíveis."
            : "As faixas aparecem conforme os registros são preenchidos."}
      </p>
    </div>
  );
}
