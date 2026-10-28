import type { ReactElement } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { ArrowRight } from "lucide-react";
import type { HomeData } from "./home-parts";
import { useChartEntrance } from "./use-chart-entrance";
import styles from "./home-audience.module.css";

type AgeGroups = HomeData["studentAges"];
const COLORS: Record<string, string> = {
  children: "var(--brand)",
  teens: "var(--lesson-personalized-foreground)",
  adults: "var(--interactive)",
  unknown: "var(--muted-foreground)",
};

export function StudentAgeChart({
  groups,
  total,
}: {
  groups: AgeGroups;
  total: number;
}): ReactElement {
  const animate = useChartEntrance();
  const knownGroups = groups.filter((group) => group.id !== "unknown" || group.count > 0);
  const slices = groups.filter((group) => group.count > 0);
  return (
    <div className={styles.ages}>
      <div className={styles.donut}>
        <div className={styles.donutPlot} aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <PieChart>
              <Pie
                data={slices}
                dataKey="count"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius="72%"
                outerRadius="96%"
                startAngle={90}
                endAngle={-270}
                paddingAngle={slices.length > 1 ? 2 : 0}
                stroke="none"
                isAnimationActive={animate}
                animationBegin={180}
                animationDuration={650}
                animationEasing="ease-out"
              >
                {slices.map((group) => (
                  <Cell key={group.id} fill={COLORS[group.id] ?? "var(--muted-foreground)"} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className={styles.total}>
          <strong>{total.toLocaleString("pt-BR")}</strong>
          <span>ativos</span>
        </div>
      </div>
      {total === 0 ? (
        <p className={styles.empty}>Nenhum aluno ativo.</p>
      ) : (
        <dl className={styles.ageLegend} aria-label="Alunos ativos por faixa etária">
          {knownGroups.map((group) => (
            <div key={group.id}>
              <dt>
                <svg width="7" height="7" aria-hidden="true">
                  <circle cx="3.5" cy="3.5" r="3.5" fill={COLORS[group.id]} />
                </svg>
                {group.label}
              </dt>
              <dd>{group.count.toLocaleString("pt-BR")}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

export function LeadConversion({ data }: { data: HomeData["leadConversion"] }): ReactElement {
  const rate = data.leads > 0 ? data.converted / data.leads : 0;
  const month = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(
    new Date(`${data.month}-01T12:00:00Z`),
  );
  return (
    <div className={styles.conversion}>
      <div className={styles.conversionTop}>
        <strong>
          {data.leads > 0
            ? new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 }).format(
                rate,
              )
            : "—"}
        </strong>
        <span>dos leads de {month}</span>
      </div>
      <svg
        className={styles.conversionTrack}
        viewBox="0 0 100 8"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <rect width="100" height="8" rx="2" fill="currentColor" opacity="0.12" />
        <rect width={rate * 100} height="8" rx="2" fill="currentColor" />
      </svg>
      <div
        className={styles.conversionFlow}
        aria-label="Conversão dos leads cadastrados no mês para alunos vinculados"
      >
        <span>
          <strong>{data.leads}</strong> leads
        </span>
        <ArrowRight aria-hidden="true" />
        <span>
          <strong>{data.converted}</strong> com aluno vinculado
        </span>
      </div>
      {data.leads === 0 && <p className={styles.empty}>Sem leads cadastrados no mês.</p>}
    </div>
  );
}
