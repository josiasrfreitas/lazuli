import type { ReactElement, ReactNode } from "react";
import type { RouterOutputs } from "@lazuli/api";
export type Analytics = RouterOutputs["finance"]["analytics"];
export const CHART_COLORS = [
  "var(--info)",
  "var(--success)",
  "var(--warning)",
  "var(--muted-foreground)",
];
export const AXIS_STYLE = { fill: "var(--muted-foreground)", fontSize: 12 };
export const TOOLTIP_STYLE = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)",
  color: "var(--foreground)",
  fontFamily: "var(--font-numeric)",
};
const CENTS_PER_UNIT = 100;
export const CHART_HEIGHT = 280;
export function compactMoney(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(
    cents / CENTS_PER_UNIT,
  );
}
export function monthLabel(month: string): string {
  return new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" })
    .format(new Date(`${month}-01`))
    .replace(".", "");
}
export function ChartPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}): ReactElement {
  return (
    <section className="min-w-0 rounded-xl border border-border bg-card p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-heading">{title}</h2>
      <p className="mt-1 text-caption text-muted-foreground">{description}</p>
      {children}
    </section>
  );
}
export function ChartLegend({ label, color }: { label: string; color: string }): ReactElement {
  return (
    <span className="inline-flex items-center gap-2 text-caption text-muted-foreground">
      <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
