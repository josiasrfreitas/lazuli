"use client";
import type { ReactElement } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AXIS,
  CHART_HEIGHT,
  COLORS,
  COMPETENCES,
  COMPETENCE_LABELS,
  MAX,
  PASS,
  PHASE_LABELS,
  TOOLTIP,
  type Assessment,
} from "./shared";

export function AcademicProgressChart({ data }: { data: Assessment }): ReactElement {
  const points = [
    "BLOCK_ONE",
    "BLOCK_TWO",
    ...(data.grades.some((grade) => grade.phase === "RECOVERY") ? ["RECOVERY"] : []),
  ].map((phase) => ({
    phase: PHASE_LABELS[phase as keyof typeof PHASE_LABELS],
    ...Object.fromEntries(
      COMPETENCES.map((competence) => [
        competence,
        data.grades.find((grade) => grade.competence === competence && grade.phase === phase)
          ?.score ?? null,
      ]),
    ),
  }));
  if (data.grades.length === 0)
    return (
      <div className="flex h-60 items-center justify-center rounded-md bg-muted/30 p-5 text-center text-caption text-muted-foreground">
        O gráfico aparece quando as primeiras notas forem registradas.
      </div>
    );
  return (
    <div
      className="min-w-0"
      role="img"
      aria-label="Evolução das quatro competências entre os blocos. Notas detalhadas na tabela abaixo."
    >
      <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={0}>
        <LineChart
          data={points}
          margin={{ top: 18, right: 20, bottom: 6, left: -16 }}
          accessibilityLayer
        >
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis dataKey="phase" tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis
            domain={[0, MAX]}
            ticks={[0, 20, 40, PASS, 80, MAX]}
            tick={AXIS}
            axisLine={false}
            tickLine={false}
          />
          <ReferenceLine y={PASS} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
          <Tooltip contentStyle={TOOLTIP} />
          <Legend iconType="plainline" iconSize={16} />
          {COMPETENCES.map((competence, index) => (
            <Line
              key={competence}
              type="linear"
              name={COMPETENCE_LABELS[competence]}
              dataKey={competence}
              stroke={COLORS[index]}
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 5 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <p className="text-center text-caption text-muted-foreground">
        Corte de aprovação: 60 em cada competência.
      </p>
    </div>
  );
}
