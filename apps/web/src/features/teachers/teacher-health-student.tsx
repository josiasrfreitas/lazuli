"use client";

import type { ReactElement } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { RouterOutputs } from "@lazuli/api";
import { StudentAvatar } from "~/components/student-avatar";
import { metricNumber } from "./teacher-metric-details";
import styles from "./teacher-overview.module.css";
import preview from "./teacher-health-student.module.css";

const FULL_ATTENDANCE_PERCENT = 100;
type Student = RouterOutputs["teachers"]["metrics"]["students"][number];

export function TeacherHealthStudent({ student }: { student: Student }): ReactElement {
  return (
    <li className={preview.item}>
      <Link
        className={`${styles.healthFocus} ${preview.trigger}`}
        href={`/alunos/${student.id}?secao=pedagogico`}
        data-level={student.level}
        aria-label={`${student.name}, score ${metricNumber(student.score)}. Abrir aluno`}
        onPointerEnter={(event) => delete event.currentTarget.dataset.dismissed}
        onFocus={(event) => delete event.currentTarget.dataset.dismissed}
        onKeyDown={(event) => {
          if (event.key === "Escape") event.currentTarget.dataset.dismissed = "true";
        }}
      >
        <StudentAvatar name={student.name} colorKey={student.id} size="sm" />
        <b>{metricNumber(student.score)}</b>
        <strong>{student.name}</strong>
        <div className={preview.panel}>
          <div className={preview.identity}>
            <StudentAvatar name={student.name} colorKey={student.id} size="lg" />
            <span className={preview.name}>{student.name}</span>
            <ExternalLink className={preview.openIcon} aria-hidden="true" />
          </div>
          <dl className={preview.facts}>
            <div>
              <dt>Score individual</dt>
              <dd>{metricNumber(student.score)}</dd>
            </div>
            <div>
              <dt>Média das notas</dt>
              <dd>{student.grades === null ? "Sem notas" : metricNumber(student.grades)}</dd>
            </div>
            <div>
              <dt>Frequência</dt>
              <dd>
                {student.attendance.percent === null
                  ? "Sem chamada"
                  : `${metricNumber(FULL_ATTENDANCE_PERCENT - student.attendance.percent)}%`}
              </dd>
            </div>
            <div>
              <dt>Ocorrências abertas</dt>
              <dd>{student.pending}</dd>
            </div>
          </dl>
          <span className={preview.evidence}>
            {student.availableIndicators} de 4 indicadores · {student.healthHeldSessions} aulas no
            score
          </span>
        </div>
      </Link>
    </li>
  );
}
