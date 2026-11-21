import type { RouterOutputs } from "@lazuli/api";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { trpc } from "~/lib/trpc";
import { toDateOnlySaoPaulo } from "~/lib/format";
import { AnalyticsFilters } from "./analytics-filters";
import { QueryNotice } from "./query-notice";
import { monthLabel, TOOLTIP_STYLE } from "./chart-shared";
import styles from "./operations.module.css";
import type { ReactElement } from "react";
const MONTH_KEY_LENGTH = 7;
const BAR_RADIUS = 3;
export function EnrollmentProduction({ year }: { year: number }): ReactElement {
  const query = trpc.dashboard.enrollmentProduction.useQuery({ year });
  const [owner, setOwner] = useState("all");
  const owners = new Map(
    query.data?.map((row) => [row.ownerId ?? "unknown", row.owner ?? "Sem responsável"]),
  );
  const months = enrollmentMonths(query.data, owner);
  const through = toDateOnlySaoPaulo(new Date()).slice(0, MONTH_KEY_LENGTH);
  const points = Array.from(
    { length: 12 },
    (_unused, index) => `${year}-${String(index + 1).padStart(2, "0")}`,
  )
    .filter((month) => month <= through)
    .map((month) => ({ month, count: months.get(month) ?? 0 }));
  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <div>
          <h2>Matrículas por mês</h2>
          <p>
            Pela entrada na turma, incluindo leads de anos anteriores ·{" "}
            {owners.get(owner) ?? "Todos os responsáveis"}.
          </p>
        </div>
        <AnalyticsFilters label="Responsável">
          <label>
            Responsável atual
            <select value={owner} onChange={(event) => setOwner(event.target.value)}>
              <option value="all">Todos</option>
              {[...owners].map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </AnalyticsFilters>
      </header>
      {query.data ? (
        months.size > 0 ? (
          <ProductionChart points={points} />
        ) : (
          <p>Nenhuma matrícula vinculada a lead neste recorte.</p>
        )
      ) : (
        <QueryNotice failed={query.isError} retry={() => void query.refetch()} />
      )}
    </section>
  );
}

function ProductionChart({ points }: { points: { month: string; count: number }[] }): ReactElement {
  return (
    <ResponsiveContainer width="100%" minWidth={0} height={180}>
      <BarChart data={points} accessibilityLayer>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="month"
          tickFormatter={monthLabel}
          stroke="var(--muted-foreground)"
          axisLine={false}
          tickLine={false}
          fontSize={12}
        />
        <YAxis
          allowDecimals={false}
          width={32}
          stroke="var(--muted-foreground)"
          axisLine={false}
          tickLine={false}
          fontSize={12}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelFormatter={(value) => (typeof value === "string" ? monthLabel(value) : "")}
        />
        <Bar
          dataKey="count"
          name="Matrículas"
          fill="var(--info)"
          maxBarSize={36}
          radius={[BAR_RADIUS, BAR_RADIUS, 0, 0]}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

function enrollmentMonths(
  rows: RouterOutputs["dashboard"]["enrollmentProduction"] | undefined,
  owner: string,
): Map<string, number> {
  const months = new Map<string, number>();
  for (const row of rows ?? []) {
    if (owner === "all" || owner === (row.ownerId ?? "unknown"))
      months.set(row.month, (months.get(row.month) ?? 0) + row.count);
  }
  return months;
}
