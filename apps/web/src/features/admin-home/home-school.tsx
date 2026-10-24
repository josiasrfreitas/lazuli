import { useState, type ReactElement } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@lazuli/ui";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { monthLabel } from "~/features/finance-analytics/contract-closings-model";
import type { HomeData } from "./home-parts";
import styles from "./home.module.css";
type ChartRow = { month: string; students: number; enrollments: number };
const BAR_CORNER_RADIUS = 3;
const BAR_RADIUS: [number, number, number, number] = [BAR_CORNER_RADIUS, BAR_CORNER_RADIUS, 0, 0];
export function SchoolChart({ data }: { data: HomeData }): ReactElement {
  const [table, setTable] = useState(false);
  const enrollmentByMonth = new Map(
    data.school.enrollments.series.map((row) => [row.month, row.value]),
  );
  const rows = data.school.students.series.map((row) => ({
    month: row.month,
    students: row.value,
    enrollments: enrollmentByMonth.get(row.month) ?? 0,
  }));
  return (
    <section className={styles.chartPanel} aria-label="Evolução da escola">
      <div className={styles.chartHeading}>
        <div>
          <h2>Entradas ao longo dos meses</h2>
          <p className={styles.description}>Novos alunos e entradas em turmas · 6 meses</p>
        </div>
        <Button variant="ghost" size="sm" aria-pressed={table} onClick={() => setTable(!table)}>
          {table ? "Ver gráfico" : "Ver valores"}
        </Button>
      </div>
      <p className={styles.chartLegend}>
        <span>Novos alunos</span>
        <span>Matrículas iniciadas</span>
      </p>
      {table ? <SchoolChartValues rows={rows} /> : <SchoolBarChart rows={rows} />}
      <SchoolChartFooter />
    </section>
  );
}
function SchoolChartValues({ rows }: { rows: ChartRow[] }): ReactElement {
  return (
    <table className={styles.values}>
      <thead>
        <tr>
          <th>Mês</th>
          <th>Alunos</th>
          <th>Matrículas</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.month}>
            <th scope="row">{monthLabel(row.month)}</th>
            <td>{row.students}</td>
            <td>{row.enrollments}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
function SchoolBarChart({ rows }: { rows: ChartRow[] }): ReactElement {
  return (
    <div
      role="img"
      aria-label="Novos alunos e matrículas por mês; números disponíveis em Ver valores."
    >
      <ResponsiveContainer width="100%" height={220} minWidth={0}>
        <BarChart data={rows} accessibilityLayer margin={{ top: 12, right: 0, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5" />
          <XAxis
            dataKey="month"
            tickFormatter={monthLabel}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            width={32}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={({ active, payload }) =>
              active && payload?.length ? (
                <div className={styles.tooltip}>
                  {payload.map((item) => (
                    <p key={String(item.dataKey)}>
                      {item.name}: {item.value}
                    </p>
                  ))}
                </div>
              ) : null
            }
            cursor={false}
          />
          <SchoolBars />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
function SchoolBars(): ReactElement {
  return (
    <>
      <Bar
        dataKey="students"
        name="Novos alunos"
        fill="var(--border-strong)"
        radius={BAR_RADIUS}
        maxBarSize={24}
        isAnimationActive={false}
      />
      <Bar
        dataKey="enrollments"
        name="Matrículas"
        fill="var(--interactive)"
        radius={BAR_RADIUS}
        maxBarSize={24}
        isAnimationActive={false}
      />
    </>
  );
}
function SchoolChartFooter(): ReactElement {
  return (
    <div className={styles.chartFooter}>
      <p className={styles.chartNote}>
        Matrículas contam entradas em turmas, incluindo transferências.
        <br />
        Cadastros de alunos não representam contratos ou vendas.
      </p>
      <Link className={styles.textLink} href="/organizacao">
        Explorar turmas
        <ArrowUpRight aria-hidden="true" />
      </Link>
    </div>
  );
}
