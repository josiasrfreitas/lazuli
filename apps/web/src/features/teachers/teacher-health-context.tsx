import type { ReactElement } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import type { RouterOutputs } from "@lazuli/api";
import { Avatar } from "@lazuli/ui";
import { TeacherHealthContextLoading } from "./teacher-metric-loading";
import { metricNumber } from "./teacher-metric-details";
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
  const partial = data.students.filter(
    (student) => student.score !== null && student.availableIndicators < 4,
  ).length;
  const missing = data.studentCount - data.coveredStudents;
  return (
    <div className={styles.healthContext}>
      {flagged.length > 0 ? (
        <>
          <h3 className={styles.healthFocusHeading}>Para acompanhar de perto</h3>
          <ul
            className={styles.healthFocusList}
            data-single={flagged.length === 1 || undefined}
            aria-label="Alunos em atenção, por menor score"
          >
            {flagged.map((student) => (
              <li key={student.id}>
                <Link
                  className={styles.healthFocus}
                  href={`/alunos/${student.id}?secao=pedagogico`}
                  data-level={student.level}
                  aria-label={`${student.name}, ${metricNumber(student.score)} pontos, ${student.level === "PRIORITY" ? "prioridade" : "em atenção"}`}
                  title={student.name}
                >
                  <Avatar name={student.name} colorKey={student.id} size="sm" />
                  <b>
                    {metricNumber(student.score)} <small>pts</small>
                  </b>
                  <strong>{student.name}</strong>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : (
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
