import type { ReactElement, ReactNode } from "react";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  Users,
  GraduationCap,
  CalendarCheck2,
} from "lucide-react";
import { Badge } from "@lazuli/ui";
import type { RouterOutputs } from "@lazuli/api";
import { monthLabel } from "~/features/finance-analytics/contract-closings-model";
import type { HomeData } from "./home-parts";
import styles from "./home.module.css";

export type BusinessData = RouterOutputs["dashboard"]["business"];
type Series = { month: string; value: number }[];
type Direction = "flat" | "up" | "down";
const PERCENT = 100;
const PLOT = { left: 4, right: 156, baseline: 42, height: 34 } as const;
function trendDirection(current: number, previous: number): Direction {
  if (current === previous) return "flat";
  return current > previous ? "up" : "down";
}
function trendLabel(current: number, previous: number): string {
  if (previous === 0) return current === previous ? "Sem variação" : "Sem base anterior";
  const change = ((current - previous) / previous) * PERCENT;
  return `${change > 0 ? "+" : ""}${change.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}
function trendVariant(direction: Direction, previous: number): "success" | "warning" | "neutral" {
  if (direction === "up" && previous > 0) return "success";
  if (direction === "down") return "warning";
  return "neutral";
}
function trendIcon(direction: Direction): typeof Minus {
  if (direction === "up") return ArrowUpRight;
  if (direction === "down") return ArrowDownRight;
  return Minus;
}
export function Trend({
  current,
  previous,
  partial,
}: {
  current: number;
  previous: number;
  partial: boolean;
}): ReactElement {
  const direction = trendDirection(current, previous);
  const Icon = trendIcon(direction);
  return (
    <div className={styles.trend}>
      <Badge variant={trendVariant(direction, previous)}>
        <Icon aria-hidden="true" />
        {trendLabel(current, previous)}
      </Badge>
      <span>{partial ? "vs. mesmos dias do mês anterior" : "vs. mês anterior"}</span>
    </div>
  );
}
type SparkRange = { min: number; max: number };
function sparkY(value: number, { min, max }: SparkRange): number {
  return PLOT.baseline - ((value - min) / (max - min)) * PLOT.height;
}
function sparkX(index: number, length: number): number {
  return PLOT.left + (index / Math.max(1, length - 1)) * (PLOT.right - PLOT.left);
}
export function Sparkline({ series, label }: { series: Series; label: string }): ReactElement {
  const max = Math.max(1, ...series.map((point) => point.value));
  const min = Math.min(0, ...series.map((point) => point.value));
  const range = { min, max };
  const points = series
    .map((point, index) => `${sparkX(index, series.length)},${sparkY(point.value, range)}`)
    .join(" ");
  const last = series.at(-1);
  return (
    <svg viewBox="0 0 160 48" className={styles.sparkline} role="img" aria-label={label}>
      <title>
        {series
          .map((point) => `${monthLabel(point.month)}: ${point.value.toLocaleString("pt-BR")}`)
          .join("; ")}
      </title>
      <path d="M4 43H156" className={styles.sparkBaseline} />
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {last && <circle cx="156" cy={sparkY(last.value, range)} r="3" fill="currentColor" />}
    </svg>
  );
}
function Metric({
  label,
  value,
  context,
  href,
  icon,
  variant,
  children,
}: {
  label: string;
  value: string;
  context: string;
  href: string;
  icon: ReactNode;
  variant?: "lead" | "attention";
  children: ReactNode;
}): ReactElement {
  return (
    <article className={styles.metric} data-variant={variant}>
      <div className={styles.metricHeading}>
        <h2>
          {icon}
          {label}
        </h2>
        <Link href={href} aria-label={`Abrir detalhes de ${label}`}>
          <ArrowUpRight aria-hidden="true" />
        </Link>
      </div>
      <div className={styles.metricValue}>{value}</div>
      <p className={styles.metricContext}>{context}</p>
      {children}
    </article>
  );
}
export function SchoolMetrics({ data }: { data: HomeData }): ReactElement {
  const school = data.school;
  const metrics = [
    {
      label: "Matrículas iniciadas",
      metric: school.enrollments,
      context: "Entradas em turmas, incluindo transferências",
      href: "/organizacao",
      icon: <GraduationCap aria-hidden="true" />,
    },
    {
      label: "Novos alunos",
      metric: school.students,
      context: "Cadastros de alunos no período",
      href: "/alunos",
      icon: <Users aria-hidden="true" />,
    },
    {
      label: "Experimentais realizadas",
      metric: school.trials,
      context: "Aulas experimentais com presença registrada",
      href: "/interessados",
      icon: <CalendarCheck2 aria-hidden="true" />,
    },
  ];
  return (
    <div className={styles.metrics} aria-label="Indicadores da escola">
      {metrics.map((item, index) => (
        <Metric
          key={item.label}
          label={item.label}
          value={item.metric.value.toLocaleString("pt-BR")}
          context={item.context}
          href={item.href}
          icon={item.icon}
          {...(index === 0 ? { variant: "lead" as const } : {})}
        >
          <div className={styles.metricBottom}>
            <Trend
              current={item.metric.value}
              previous={item.metric.previous}
              partial={school.partial}
            />
            <Sparkline series={item.metric.series} label={`${item.label} nos últimos seis meses`} />
          </div>
        </Metric>
      ))}
    </div>
  );
}
