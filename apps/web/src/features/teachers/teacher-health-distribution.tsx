import type { ReactElement } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { InlineSkeleton } from "@lazuli/ui";
import styles from "./teacher-overview.module.css";

const DISPLAYED_BAND_COUNT = 3;
const BANDS = [
  { level: "HEALTHY", label: "Saudáveis" },
  { level: "ATTENTION", label: "Em atenção" },
  { level: "PRIORITY", label: "Prioridade" },
  { level: "INSUFFICIENT_DATA", label: "Sem dados suficientes" },
] as const;

export function TeacherHealthDistribution({
  data,
  pending,
}: {
  data: RouterOutputs["teachers"]["metrics"] | undefined;
  pending: boolean;
}): ReactElement {
  const bands = BANDS.map((band) => ({
    ...band,
    count: data?.students.filter((student) => student.level === band.level).length ?? 0,
  }));
  const total = bands.reduce((sum, band) => sum + band.count, 0);
  return (
    <div className={styles.healthBands}>
      <svg
        className={styles.healthDistribution}
        viewBox={`0 0 ${Math.max(total, 1)} 1`}
        preserveAspectRatio="none"
        role="img"
        aria-hidden={!data}
        aria-label={
          total
            ? `Distribuição da saúde dos alunos: ${bands.map((band) => `${band.label}: ${band.count}`).join("; ")}`
            : "Nenhum aluno para calcular a distribuição de saúde"
        }
      >
        {bands.map((band, index) =>
          band.count > 0 ? (
            <rect
              key={band.level}
              data-level={band.level}
              x={bands.slice(0, index).reduce((sum, previous) => sum + previous.count, 0)}
              width={band.count}
              height={1}
            >
              <title>{`${band.label}: ${band.count} de ${total} alunos`}</title>
            </rect>
          ) : null,
        )}
      </svg>
      {bands.slice(0, DISPLAYED_BAND_COUNT).map((band) => (
        <div key={band.level} data-level={band.level}>
          <strong>
            {pending ? <InlineSkeleton className="w-8" /> : bandCount(band.count, data)}
          </strong>
          <span>{band.label}</span>
        </div>
      ))}
    </div>
  );
}

function bandCount(
  count: number,
  data: RouterOutputs["teachers"]["metrics"] | undefined,
): number | string {
  return data ? count : "—";
}
