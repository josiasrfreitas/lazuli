"use client";
import type { ReactElement } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AXIS,
  CHART_HEIGHT,
  COMPETENCES,
  COMPETENCE_LABELS,
  MAX,
  PASS,
  TOOLTIP,
  gradeLabel,
  type Assessment,
} from "./shared";
export function ClassPerformanceChart({
  rows,
  selected,
}: {
  rows: Assessment[];
  selected: Assessment | undefined;
}): ReactElement {
  const points = COMPETENCES.map((competence) => {
    const grades = rows
      .map((row) => row.results.find((result) => result.competence === competence)?.effective)
      .filter((value): value is number => value !== null && value !== undefined);
    return {
      name: COMPETENCE_LABELS[competence],
      count: grades.length,
      average: grades.length ? grades.reduce((sum, score) => sum + score, 0) / grades.length : null,
      student:
        selected?.results.find((result) => result.competence === competence)?.effective ?? null,
    };
  });
  return (
    <div className="grid min-w-0 gap-3">
      <div
        role="img"
        aria-label="Média por competência e comparação com o aluno selecionado. Quantidades e valores abaixo do gráfico."
      >
        <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={0}>
          <BarChart
            data={points}
            margin={{ top: 12, right: 12, bottom: 0, left: -16 }}
            accessibilityLayer
          >
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} />
            <YAxis
              domain={[0, MAX]}
              ticks={[0, 20, 40, PASS, 80, MAX]}
              tick={AXIS}
              axisLine={false}
              tickLine={false}
            />
            <ReferenceLine y={PASS} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
            <Tooltip
              contentStyle={TOOLTIP}
              formatter={(value) => (typeof value === "number" ? gradeLabel(value) : value)}
            />
            <Bar
              dataKey="average"
              name="Média da turma"
              fill="var(--info)"
              maxBarSize={32}
              isAnimationActive={false}
            />
            {selected && (
              <Bar
                dataKey="student"
                name={selected.student.fullName}
                fill="var(--warning)"
                maxBarSize={32}
                isAnimationActive={false}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {points.map((point) => (
          <div key={point.name}>
            <dt className="text-caption text-muted-foreground">
              {point.name} · {point.count} {point.count === 1 ? "aluno" : "alunos"}
            </dt>
            <dd className="font-numeric text-lg font-semibold tabular-nums">
              {gradeLabel(point.average)}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-caption text-muted-foreground">
        Azul: turma · Dourado: aluno selecionado. Cada média usa somente competências com as duas
        unidades registradas, incluindo a recuperação quando houver.
      </p>
    </div>
  );
}
