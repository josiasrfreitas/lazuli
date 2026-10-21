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
  const points = progressChartPoints(data);
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
      <ProgressChartCanvas points={points} domain={domain} />
    </div>
  );
}

function gradeRange(scores: number[]): [number, number] {
  if (scores.length === 0) return [0, MAX];
  const padding = 2;
  const step = SCALE_STEP;
  const minimumSpan = MIN_SCALE_SPAN;
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
  const step = scaleStep(max - min);
  const ticks = [min, max];
  if (min <= PASS && max >= PASS) ticks.push(PASS);
  for (let value = Math.ceil(min / step) * step; value < max; value += step) {
    if (value - min >= SCALE_STEP && max - value >= SCALE_STEP) ticks.push(value);
  }
  return [...new Set(ticks)].toSorted((left, right) => left - right);
}

function ProgressChartCanvas({ points, domain }: ProgressChartCanvasInput): ReactElement {
  return (
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
            dot={{ [DOT_RADIUS_KEY]: DOT_RADIUS, fill: "var(--accent)", strokeWidth: 2 }}
            activeDot={{ [DOT_RADIUS_KEY]: ACTIVE_DOT_RADIUS, fill: "var(--accent)" }}
            connectNulls={false}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

type ProgressPoint = Record<string, string | number | null>;
type ProgressChartCanvasInput = { points: ProgressPoint[]; domain: number[] };
function progressChartPoints(data: Assessment): ProgressPoint[] {
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

const DOT_RADIUS_KEY = "r";
const DOT_RADIUS = 3;
const ACTIVE_DOT_RADIUS = 5;

const SCALE_STEP = 5;
const MIN_SCALE_SPAN = 20;
const LARGE_SPAN = 50;
const LARGE_TICK_STEP = 20;
const MEDIUM_SPAN = 30;
const MEDIUM_TICK_STEP = 10;

function scaleStep(span: number): number {
  if (span > LARGE_SPAN) return LARGE_TICK_STEP;
  return span > MEDIUM_SPAN ? MEDIUM_TICK_STEP : SCALE_STEP;
}
