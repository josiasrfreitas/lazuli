import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RouterOutputs } from "@lazuli/api";
import { formatAttendancePercent, formatDateOnlyBR } from "~/lib/format";
import { trpc } from "~/lib/trpc";
import { AnalyticsFilters } from "./analytics-filters";
import { QueryNotice } from "./query-notice";
import { TOOLTIP_STYLE } from "./chart-shared";
import styles from "./operations.module.css";
import type { ReactElement } from "react";
const WEEK_DAYS = 7;
const ISO_DATE_LENGTH = 10;
const SHORT_DATE_LENGTH = 5;
const HALF = 0.5;
const MONTHS_PER_YEAR = 12;

type WeeklyRows = RouterOutputs["dashboard"]["weeklyAttendance"];
export function AttendanceTrend({
  rows,
  group,
}: {
  rows: WeeklyRows;
  group: string;
}): ReactElement {
  const aggregate = new Map<string, { present: number; marked: number }>();
  for (const row of rows) {
    if (group && row.classId !== group) continue;
    const week = aggregate.get(row.week) ?? { present: 0, marked: 0 };
    week.present += row.present;
    week.marked += row.marked;
    aggregate.set(row.week, week);
  }
  const weeks = [...aggregate.keys()].toSorted();
  const first = weeks[0],
    last = weeks.at(-1);
  if (!first || !last) return <p>Nenhuma chamada confirmada no período selecionado.</p>;
  const points: { week: string; rate: number | null }[] = [];
  for (
    const day = new Date(first);
    day <= new Date(last);
    day.setUTCDate(day.getUTCDate() + WEEK_DAYS)
  ) {
    const week = day.toISOString().slice(0, ISO_DATE_LENGTH);
    const row = aggregate.get(week);
    points.push({ week, rate: row ? row.present / row.marked : null });
  }
  return (
    <div role="group" aria-label="Evolução semanal da frequência">
      <ResponsiveContainer width="100%" minWidth={0} height={168}>
        <LineChart
          data={points}
          accessibilityLayer
          margin={{ top: 12, right: 18, bottom: 4, left: 0 }}
        >
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="week"
            tickFormatter={(day: string) => formatDateOnlyBR(day).slice(0, SHORT_DATE_LENGTH)}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            minTickGap={30}
          />
          <YAxis
            width={42}
            domain={[0, 1]}
            ticks={[0, HALF, 1]}
            tickFormatter={formatAttendancePercent}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelFormatter={(day) =>
              `Semana de ${formatDateOnlyBR(typeof day === "string" ? day : "")}`
            }
            formatter={(value) => [formatAttendancePercent(Number(value)), "Frequência"]}
          />
          <Line
            type="linear"
            dataKey="rate"
            stroke="var(--info)"
            strokeWidth={2.5}
            dot={points.length <= MONTHS_PER_YEAR}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
export function SchoolAttendanceTrend({ year }: { year: number }): ReactElement {
  const query = trpc.dashboard.weeklyAttendance.useQuery({ year });
  const [group, setGroup] = useState("");
  const classes = new Map(query.data?.map((row) => [row.classId, row.className]));
  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <div>
          <h2>Frequência semanal</h2>
          <p>
            {classes.get(group) ?? "Todas as turmas"} · presenças entre as chamadas confirmadas.
          </p>
        </div>
        <AnalyticsFilters label="Turma">
          <label>
            Turma
            <select value={group} onChange={(event) => setGroup(event.target.value)}>
              <option value="">Todas as turmas</option>
              {[...classes].map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </AnalyticsFilters>
      </header>
      {query.data ? (
        <AttendanceTrend rows={query.data} group={group} />
      ) : (
        <QueryNotice failed={query.isError} retry={() => void query.refetch()} />
      )}
    </section>
  );
}
