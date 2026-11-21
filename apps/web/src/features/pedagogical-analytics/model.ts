import type { RouterOutputs } from "@lazuli/api";
type Dashboard = RouterOutputs["dashboard"];
export type Period = Dashboard["pedagogicalPeriods"]["periods"][number];
export type Retention = Dashboard["pedagogicalRetention"]["rows"][number];
export type Indicators = Dashboard["pedagogicalIndicators"];
export type Demand = Dashboard["pedagogicalDemand"]["rows"][number] & {
  regularReferral?: number;
  direct?: number;
};
export type Group = "school" | "age" | "teacher";
export const metricLabels = {
  score: "Score",
  attendance: "Frequência",
  grades: "Notas",
  occurrences: "Ocorrências",
};
export type Metric = keyof typeof metricLabels;
export const units = {
  score: "pontos",
  attendance: "%",
  grades: "pontos",
  occurrences: "registros",
};
export const groupLabels = { school: "Toda a escola", teacher: "Professor", age: "Faixa etária" };
export const PERCENT_SCALE = 100;
export const periodLabel = (term: Period): string =>
  term.previous ? `${term.previous} → ${term.period}` : term.period;
export const numberLabel = (count: number | null): string =>
  count === null ? "Sem base" : count.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
export const rate = (count: number, denominator: number): number | null =>
  denominator ? (count * PERCENT_SCALE) / denominator : null;
export const percentage = (count: number, denominator: number): string =>
  denominator ? `${numberLabel(rate(count, denominator))}%` : "Sem base";
