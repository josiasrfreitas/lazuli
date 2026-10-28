"use client";
import { ChartNoAxesCombined, ZoomIn, ZoomOut } from "lucide-react";
import { useState, type ReactElement } from "react";
import { Button } from "@lazuli/ui";
import {
  CartesianGrid,
  Dot,
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

const WIDE_SCORE_RANGE = 50;
const WIDE_SCORE_TICK_STEP = 20;
const MEDIUM_SCORE_RANGE = 30;
const MEDIUM_SCORE_TICK_STEP = 10;
const MIN_SCORE_TICK_SPACING = 5;

function progressPoints(
  data: Assessment,
): { phase: string; [key: string]: string | number | null }[] {
  return [
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
}

export function AcademicProgressChart({
  data,
  prominent = false,
}: {
  data: Assessment;
  prominent?: boolean;
}): ReactElement {
  const [fullScale, setFullScale] = useState(false);
  const cropped = gradeRange(data.grades.map((grade) => grade.score));
  const domain: [number, number] = fullScale ? [0, MAX] : cropped;
  const points = progressPoints(data);
  if (data.grades.length === 0)
    return (
      <div className="flex min-h-60 flex-col items-center justify-center gap-4 py-8 text-center">
        <ChartNoAxesCombined
          aria-hidden="true"
          className="size-10 text-muted-foreground"
          strokeWidth={1.5}
        />
        <p className="max-w-sm text-base text-heading">
          Cada nota revela um pouco do caminho. Registre a primeira para acompanhar a evolução.
        </p>
      </div>
    );
  return (
    <div
      className="min-w-0"
      role="group"
      aria-label={`Evolução das quatro competências entre as unidades. Escala de ${domain[0]} a ${domain[1]}. Use as setas para explorar as notas.`}
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
      <ProgressPlot domain={domain} points={points} height={prominent ? 320 : CHART_HEIGHT} />
    </div>
  );
}

function ProgressPlot({
  domain,
  points,
  height,
}: {
  domain: [number, number];
  points: ReturnType<typeof progressPoints>;
  height: number;
}): ReactElement {
  return (
    <ResponsiveContainer width="100%" height={height} minWidth={0}>
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
          ticks={scaleTicks(domain[0], domain[1])}
          interval={0}
          tick={AXIS}
          axisLine={false}
          tickLine={false}
        />
        {domain[0] <= PASS && domain[1] >= PASS && (
          <ReferenceLine y={PASS} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
        )}
        <Tooltip contentStyle={TOOLTIP} />
        <Legend iconType="plainline" iconSize={12} wrapperStyle={{ fontSize: 12 }} />
        {COMPETENCES.map((competence) => progressLine(competence))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function progressLine(competence: (typeof COMPETENCES)[number]): ReactElement {
  return (
    <Line
      key={competence}
      type="linear"
      name={COMPETENCE_LABELS[competence]}
      dataKey={competence}
      stroke={COMPETENCE_VISUALS[competence].color}
      strokeWidth={2}
      dot={<Dot r={3} fill="var(--accent)" strokeWidth={2} />}
      activeDot={<Dot r={5} fill="var(--accent)" />}
      connectNulls={false}
      isAnimationActive={false}
    />
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
  let step = MIN_SCORE_TICK_SPACING;
  if (max - min > WIDE_SCORE_RANGE) step = WIDE_SCORE_TICK_STEP;
  else if (max - min > MEDIUM_SCORE_RANGE) step = MEDIUM_SCORE_TICK_STEP;
  const ticks = [min, max];
  if (min <= PASS && max >= PASS) ticks.push(PASS);
  for (let value = Math.ceil(min / step) * step; value < max; value += step) {
    if (value - min >= MIN_SCORE_TICK_SPACING && max - value >= MIN_SCORE_TICK_SPACING)
      ticks.push(value);
  }
  return [...new Set(ticks)].toSorted((left, right) => left - right);
}
