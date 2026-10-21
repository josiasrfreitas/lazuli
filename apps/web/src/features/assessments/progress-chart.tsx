"use client";
import { ZoomIn, ZoomOut } from "lucide-react";
import { useState, type ReactElement } from "react";
import { Button } from "@lazuli/ui";
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
  COMPETENCE_VISUALS,
  COMPETENCES,
  COMPETENCE_LABELS,
  MAX,
  PASS,
  PHASE_LABELS,
  TOOLTIP,
  type Assessment,
} from "./shared";

export function AcademicProgressChart({ data }: { data: Assessment }): ReactElement {
  const [fullScale, setFullScale] = useState(false);
  const cropped = gradeRange(data.grades.map((grade) => grade.score));
  const domain = fullScale ? [0, MAX] : cropped;
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
      role="group"
      aria-label={`Evolução das quatro competências entre as unidades. Escala de ${domain[0]} a ${domain[1]}. Notas detalhadas na tabela.`}
    >
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium text-heading">Evolução das notas</h3>
        {(cropped[0] > 0 || cropped[1] < MAX) && (
          <Button
            variant="text"
            size="inline"
            onClick={() => setFullScale(!fullScale)}
            aria-pressed={fullScale}
          >
            {fullScale ? <ZoomIn aria-hidden="true" /> : <ZoomOut aria-hidden="true" />}
            {fullScale ? "Aproximar escala" : "Ver de 0 a 100"}
          </Button>
        )}
      </div>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT} minWidth={0}>
        <LineChart
          data={points}
          margin={{ top: 18, right: 20, bottom: 6, left: -16 }}
          accessibilityLayer
        >
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="phase"
            tick={AXIS}
            axisLine={false}
            tickLine={false}
            padding={{ left: 12, right: 12 }}
          />
          <YAxis
            domain={domain}
            ticks={scaleTicks(domain[0]!, domain[1]!)}
            interval={0}
            tick={AXIS}
            axisLine={false}
            tickLine={false}
          />
          {domain[0]! <= PASS && domain[1]! >= PASS && (
            <ReferenceLine y={PASS} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
          )}
          <Tooltip contentStyle={TOOLTIP} />
          <Legend iconType="plainline" iconSize={12} wrapperStyle={{ fontSize: 12 }} />
          {COMPETENCES.map((competence) => (
            <Line
              key={competence}
              type="linear"
              name={COMPETENCE_LABELS[competence]}
              dataKey={competence}
              stroke={COMPETENCE_VISUALS[competence].color}
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--accent)", strokeWidth: 2 }}
              activeDot={{ r: 5, fill: "var(--accent)" }}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function gradeRange(scores: number[]): [number, number] {
  if (scores.length === 0) return [0, MAX];
  const padding = 2;
  const step = 5;
  const minimumSpan = 20;
  let min = Math.max(0, Math.floor((Math.min(...scores) - padding) / step) * step);
  let max = Math.min(MAX, Math.ceil((Math.max(...scores) + padding) / step) * step);
  if (max - min < minimumSpan) {
    const midpoint = (min + max) / 2;
    min = Math.max(0, Math.floor((midpoint - minimumSpan / 2) / step) * step);
    max = Math.min(MAX, min + minimumSpan);
    min = Math.max(0, max - minimumSpan);
  }
  return [min, max];
}
function scaleTicks(min: number, max: number): number[] {
  const step = max - min > 50 ? 20 : max - min > 30 ? 10 : 5;
  const ticks = [min, max];
  if (min <= PASS && max >= PASS) ticks.push(PASS);
  for (let value = Math.ceil(min / step) * step; value < max; value += step) {
    if (value - min >= 5 && max - value >= 5) ticks.push(value);
  }
  return [...new Set(ticks)].sort((left, right) => left - right);
}
