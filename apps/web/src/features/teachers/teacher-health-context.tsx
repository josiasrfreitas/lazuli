import { TeacherHealthStudent } from "./teacher-health-student";
import type { ReactElement } from "react";
import { Check } from "lucide-react";
import type { RouterOutputs } from "@lazuli/api";
import { TeacherHealthContextLoading } from "./teacher-metric-loading";
import styles from "./teacher-overview.module.css";

const HIGHLIGHT_COUNT = 3;
const INDICATOR_COUNT = 4;

export function TeacherHealthContext({
  data,
}: {
  data: RouterOutputs["teachers"]["metrics"] | undefined;
}): ReactElement {
  if (!data) return <TeacherHealthContextLoading />;
  const flagged = data.students
    .filter((student) => student.level === "ATTENTION" || student.level === "PRIORITY")
    .toSorted(
      (left, right) =>
        (left.score ?? 0) - (right.score ?? 0) || left.name.localeCompare(right.name, "pt-BR"),
    )
    .slice(0, HIGHLIGHT_COUNT);
  const highlightedIds = new Set(flagged.map((student) => student.id));
  const highest = data.students
    .filter((student) => student.score !== null && !highlightedIds.has(student.id))
    .toSorted(
      (left, right) =>
        (right.score ?? 0) - (left.score ?? 0) || left.name.localeCompare(right.name, "pt-BR"),
    )
    .slice(0, HIGHLIGHT_COUNT);
  const partial = data.students.filter(
    (student) => student.score !== null && student.availableIndicators < INDICATOR_COUNT,
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
              {Array.from({ length: HIGHLIGHT_COUNT - students.length }, (_empty, index) => (
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
        {coverageLabel({ partial, covered: data.coveredStudents })}
      </p>
    </div>
  );
}

function coverageLabel({ partial, covered }: { partial: number; covered: number }): string {
  if (partial > 0) {
    const cohort =
      partial === 1 ? "aluno com indicadores parciais" : "alunos com indicadores parciais";
    return `${partial} ${cohort}. Dados ausentes não viram zero.`;
  }
  return covered > 0
    ? "Os alunos avaliados têm os quatro indicadores disponíveis."
    : "As faixas aparecem conforme os registros são preenchidos.";
}
