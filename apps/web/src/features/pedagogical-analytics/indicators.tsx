import { PERCENT_SCALE } from "./model";
import type { ReactElement } from "react";
import { formatDateOnlyBR } from "~/lib/format";
import { useState } from "react";
import { trpc } from "~/lib/trpc";
import { QueryNotice } from "../finance-analytics/query-notice";
import { AttendanceTrend } from "../finance-analytics/attendance-trend";
import { ChartLayout, ChartPanel, Choices, Picker } from "./controls";
import { demoIndicators } from "./demo";
import {
  metricLabels,
  units,
  numberLabel,
  type Metric,
  type Period,
  type Indicators,
} from "./model";
import styles from "./pedagogical.module.css";
const components = {
  attendance: "Frequência compensada",
  grades: "Notas",
  occurrences: "Ocorrências",
  interventions: "Acompanhamento",
};
export function IndicatorsSection({
  period,
  demo,
  expanded,
}: {
  period: Period;
  demo: boolean;
  expanded: boolean;
}): ReactElement {
  const [group, setGroup] = useState<"teacher" | "age">("teacher");
  const [metric, setMetric] = useState<Metric>("score");
  const [selected, setSelected] = useState("");
  const query = trpc.dashboard.pedagogicalIndicators.useQuery(
    { periodId: period.id, group },
    { enabled: !demo },
  );
  const data = demo ? demoIndicators(group, period) : query.data;
  const active = data?.groups.find((entry) => entry.id === selected) ?? data?.groups[0];
  return (
    <>
      <div className={styles.controls}>
        <Choices choices={metricLabels} value={metric} label="Indicador" change={setMetric} />
        <Choices
          choices={{ teacher: "Professor", age: "Faixa etária" }}
          value={group}
          label="Agrupar indicadores"
          change={setGroup}
        />
      </div>
      {data && active && (
        <ChartLayout>
          <Comparison
            data={data}
            metric={metric}
            group={group}
            active={active}
            setSelected={setSelected}
          />
          <IndicatorPanel data={data} metric={metric} active={active} setSelected={setSelected} />
          <IndicatorDetail
            metric={metric}
            active={active}
            expanded={expanded}
            weekly={data.weekly}
          />
        </ChartLayout>
      )}
      {data && !active && <p>Nenhum aluno matriculado neste período.</p>}
      {!data && <QueryNotice failed={query.isError} retry={() => void query.refetch()} />}
    </>
  );
}
type Active = Indicators["groups"][number];
type PanelProps = {
  data: Indicators;
  active: Active;
  metric: Metric;
  setSelected: (id: string) => void;
};
const metricNotes = {
  score: "Média dos scores dos alunos com evidência · escala de 0 a 100.",
  attendance: "Presenças sobre marcações em chamadas confirmadas.",
  grades: "Média das notas por aluno · escala de 0 a 100.",
  occurrences: "Ocorrências registradas entre alunos com chamada ou ocorrência no período.",
};
function Comparison({
  data,
  active,
  group,
  metric,
  setSelected,
}: PanelProps & { group: "age" | "teacher" }): ReactElement {
  const max =
    metric === "occurrences"
      ? Math.max(1, ...data.groups.map((entry) => entry.occurrences.value ?? 0))
      : PERCENT_SCALE;
  return (
    <ChartPanel
      title={`${metricLabels[metric]} por ${group === "teacher" ? "professor" : "faixa etária"}`}
      note={metricNotes[metric]}
    >
      <div className={styles.bars}>
        {data.groups.map((entry) => (
          <button
            aria-pressed={entry.id === active.id}
            key={entry.id}
            onClick={() => setSelected(entry.id)}
          >
            <span>{entry.label}</span>
            <strong>
              {numberLabel(entry[metric].value)} {entry[metric].value !== null && units[metric]}
            </strong>
            <svg viewBox="0 0 100 4" preserveAspectRatio="none" aria-hidden="true">
              <rect width="100" height="4" fill="var(--analytics-indicator-surface)" />
              <rect
                width={((entry[metric].value ?? 0) / max) * PERCENT_SCALE}
                height="4"
                fill="var(--analytics-indicator)"
              />
            </svg>
            <small>
              {entry[metric].covered} de {entry.base} alunos com dados
            </small>
          </button>
        ))}
      </div>
    </ChartPanel>
  );
}
const detailTitles = {
  score: "Composição do score",
  attendance: "Frequência semanal",
  grades: "Cobertura das notas",
  occurrences: "Cobertura das ocorrências",
};
function IndicatorPanel({ data, active, metric, setSelected }: PanelProps): ReactElement {
  return (
    <ChartPanel title={detailTitles[metric]}>
      <Picker
        label="Grupo em detalhe"
        value={active.id}
        change={setSelected}
        options={data.groups}
      />
      {metric === "attendance" && (
        <AttendanceTrend
          group={active.id}
          rows={data.weekly.map((row) => ({
            ...row,
            classId: row.groupId,
            className: active.label,
          }))}
        />
      )}
      {metric === "score" && (
        <div className={styles.breakdown}>
          {active.components.map((component) => (
            <div key={component.key}>
              <span>
                {components[component.key]} <small>· peso {component.weight}%</small>
              </span>
              <strong>{numberLabel(component.value)}</strong>
            </div>
          ))}
        </div>
      )}
      {(metric === "grades" || metric === "occurrences") && (
        <div className={styles.coverage}>
          <strong>
            {active[metric].covered} / {active.base}
          </strong>
          <p>
            alunos com{" "}
            {metric === "grades"
              ? "notas registradas"
              : "chamada confirmada ou ocorrência registrada"}
          </p>
        </div>
      )}
      {metric === "score" && (
        <p>
          O score de cada aluno redistribui o peso dos componentes disponíveis. As médias acima usam
          a cobertura de cada componente.
        </p>
      )}
    </ChartPanel>
  );
}
function IndicatorDetail({
  active,
  expanded,
  metric,
  weekly,
}: {
  active: Active;
  expanded: boolean;
  metric: Metric;
  weekly: Indicators["weekly"];
}): ReactElement {
  return (
    <details className={styles.detail} key={String(expanded)} open={expanded}>
      <summary>Conferir os valores de {active.label}</summary>
      <div className={styles.breakdown}>
        {(Object.keys(metricLabels) as Metric[]).map((measure) => (
          <div key={measure}>
            <span>{metricLabels[measure]}</span>
            <strong>
              {numberLabel(active[measure].value)}{" "}
              {active[measure].value !== null && units[measure]}
            </strong>
            <span>
              {active[measure].covered} de {active.base} alunos
            </span>
          </div>
        ))}
      </div>
      {metric === "attendance" && (
        <div className={styles.tableWrap}>
          <table>
            <caption>Chamadas confirmadas por semana</caption>
            <thead>
              <tr>
                <th>Semana de</th>
                <th>Presenças</th>
                <th>Marcações</th>
              </tr>
            </thead>
            <tbody>
              {weekly
                .filter((row) => row.groupId === active.id)
                .map((row) => (
                  <tr key={row.week}>
                    <th>{formatDateOnlyBR(row.week)}</th>
                    <td>{row.present}</td>
                    <td>{row.marked}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
      <p>
        Grupos usam o titular no fim do período ou na última turma antes da saída. Semanas sem
        chamadas confirmadas aparecem como lacunas.
      </p>
    </details>
  );
}
