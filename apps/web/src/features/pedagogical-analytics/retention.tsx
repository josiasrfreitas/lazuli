import { PERCENT_SCALE } from "./model";
import type { ReactElement } from "react";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { trpc } from "~/lib/trpc";
import { formatDateOnlyBR } from "~/lib/format";
import { QueryNotice } from "../finance-analytics/query-notice";
import { TOOLTIP_STYLE } from "../finance-analytics/chart-shared";
import { ChartLayout, ChartPanel, Choices, Picker } from "./controls";
import { demoRetention } from "./demo";
import {
  groupLabels,
  numberLabel,
  percentage,
  periodLabel,
  rate,
  type Group,
  type Period,
  type Retention,
} from "./model";
import styles from "./pedagogical.module.css";
const BAR_RADIUS = 4,
  INACTIVE_FILL = 0.52;
const axis = {
  axisLine: false,
  tickLine: false,
  tick: { fill: "var(--muted-foreground)", fontSize: 12 },
};
const exits = "var(--analytics-exits)",
  retained = "var(--analytics-retained)",
  renewal = "var(--analytics-renewals)";
const EXIT_HISTORY_INDEX = 3;
function countLabel(count: number, [one, many]: [string, string]): string {
  return `${count} ${count === 1 ? one : many}`;
}

type RetentionProps = {
  period: Period;
  periods: Period[];
  today: string;
  demo: boolean;
  select: (id: string) => void;
  expanded: boolean;
};
export function RetentionSection({
  period,
  periods,
  today,
  demo,
  select,
  expanded,
}: RetentionProps): ReactElement {
  const [group, setGroup] = useState<Group>("school");
  const [selected, setSelected] = useState("");
  const [through, setThrough] = useState("");
  const cutoff = through && through <= today ? through : today;
  const query = trpc.dashboard.pedagogicalRetention.useQuery(
    { group, through: cutoff },
    { enabled: !demo },
  );
  const data = demo ? demoRetention(group, cutoff) : query.data?.rows;
  const { groups, groupId, history, current } = retentionSelection({
    data,
    periods,
    period,
    selected,
  });
  return (
    <>
      <div className={styles.controls}>
        <Choices
          label="Recorte de permanência"
          choices={groupLabels}
          value={group}
          change={(value) => {
            setGroup(value);
            setSelected("");
          }}
        />
        {group !== "school" && groups.length > 0 && (
          <Picker
            label={groupLabels[group]}
            value={groupId ?? ""}
            options={groups}
            change={setSelected}
          />
        )}
      </div>
      {!data && <QueryNotice failed={query.isError} retry={() => void query.refetch()} />}
      {data && (
        <ChartLayout chartIndex={EXIT_HISTORY_INDEX}>
          <DepartureSummary current={current} />
          <CohortComposition row={current} />
          <RenewalPanel
            current={current}
            history={history}
            select={select}
            cutoff={cutoff}
            today={today}
            setThrough={setThrough}
          />
          <ExitHistory current={current} history={history} select={select} />
          <RetentionDetail
            current={current}
            history={history}
            select={select}
            expanded={expanded}
          />
        </ChartLayout>
      )}
    </>
  );
}
function HistoryChart({
  rows,
  selected,
  select,
  kind,
}: {
  rows: Retention[];
  selected: string;
  select: (id: string) => void;
  kind: "exit" | "renewal";
}): ReactElement {
  const points = rows.map((row) => ({
    ...row,
    value: kind === "exit" ? (row.base ? row.exited : null) : rate(row.renewed, row.due),
  }));
  const axes = historyAxes(kind);
  const click = (entry: { activeTooltipIndex?: string | number | null | undefined }): void => {
    const row = points[Number(entry.activeTooltipIndex ?? -1)];
    if (row) select(row.id);
  };
  return (
    <div className={styles.history}>
      <ResponsiveContainer width="100%" minWidth={0} height={145}>
        {kind === "renewal" ? (
          <LineChart data={points} onClick={click} accessibilityLayer>
            {axes}
            <Line
              dataKey="value"
              stroke={renewal}
              strokeWidth={3}
              dot
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        ) : (
          <BarChart data={points} onClick={click} accessibilityLayer>
            {axes}
            <Bar
              name="Saídas"
              dataKey="value"
              maxBarSize={38}
              radius={[BAR_RADIUS, BAR_RADIUS, 0, 0]}
              isAnimationActive={false}
            >
              {points.map((row) => (
                <Cell
                  key={row.id}
                  fill={exits}
                  fillOpacity={selected === row.id ? 1 : INACTIVE_FILL}
                />
              ))}
            </Bar>
          </BarChart>
        )}
      </ResponsiveContainer>
      <HistoryPoints rows={rows} select={select} selected={selected} kind={kind} />
    </div>
  );
}

function CohortComposition({ row }: { row: Retention }): ReactElement {
  const bands = [
    { label: "Nos dois semestres", value: row.both, color: "var(--analytics-indicator)" },
    {
      label: "Só no semestre de destino",
      value: row.entrants,
      color: retained,
    },
    { label: "Só no semestre anterior", value: row.originOnly, color: renewal },
  ];
  let position = 0;
  return (
    <ChartPanel
      title="Matrículas na virada"
      note={`Matrículas de ${periodLabel(row)} · cada aluno conta uma vez.`}
    >
      {row.base + row.entrants > 0 && (
        <svg
          className={styles.composition}
          viewBox="0 0 100 8"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {bands.map((band) => {
            const width = (band.value * PERCENT_SCALE) / (row.base + row.entrants);
            const start = position;
            position += width;
            return <rect key={band.label} x={start} width={width} height="8" fill={band.color} />;
          })}
        </svg>
      )}
      <dl className={styles.cohortLegend}>
        {bands.map((band) => (
          <div key={band.label}>
            <dt>
              <svg width="9" height="9" aria-hidden="true">
                <circle cx="4.5" cy="4.5" r="4" fill={band.color} />
              </svg>
              {band.label}
            </dt>
            <dd>{band.value}</dd>
          </div>
        ))}
      </dl>
      <p>
        Entradas em {row.period} ficam fora da taxa de permanência.{" "}
        {countLabel(row.entrantExits, ["saída registrada", "saídas registradas"])} entre esses
        alunos.
      </p>
    </ChartPanel>
  );
}
function retentionSelection({
  data,
  periods,
  period,
  selected,
}: {
  data: Retention[] | undefined;
  periods: Period[];
  period: Period;
  selected: string;
}): {
  groups: { id: string; label: string }[];
  groupId: string | undefined;
  history: Retention[];
  current: Retention;
} {
  const groups = [
    ...new Map(data?.map((row) => [row.groupId, { id: row.groupId, label: row.label }])).values(),
  ];
  const defaultGroup = data?.find((row) => row.id === period.id && row.base > 0)?.groupId;
  const groupId =
    groups.find((entry) => entry.id === selected)?.id ?? defaultGroup ?? groups[0]?.id;
  const history = periods
    .filter((term) => term.previous)
    .toReversed()
    .map(
      (term) =>
        data?.find((row) => row.id === term.id && row.groupId === groupId) ?? {
          ...term,
          groupId: groupId ?? "",
          label: "",
          base: 0,
          pending: 0,
          entrants: 0,
          entrantExits: 0,
          both: 0,
          originOnly: 0,
          exited: 0,
          terminated: 0,
          transferred: 0,
          due: 0,
          renewed: 0,
        },
    );
  const current = history.find((row) => row.id === period.id)!;
  return { groups, groupId, history, current };
}
type HistoryProps = { current: Retention; history: Retention[]; select: (id: string) => void };
function DepartureSummary({ current }: { current: Retention }): ReactElement {
  if (!current.base)
    return (
      <section className={styles.lead}>
        <h2>Permanência na escola</h2>
        <div className={styles.emptyCohort}>
          <strong>Sem base para a taxa</strong>
          <p>Nenhum aluno neste recorte tem matrícula registrada no fim de {current.previous}.</p>
        </div>
        <p>As matrículas de {current.period} aparecem no gráfico da virada.</p>
      </section>
    );
  const stayed = current.base - current.exited - current.pending;
  return (
    <section className={styles.lead}>
      <div className={styles.cohort}>
        <div className={styles.outcome}>
          <h2>Saídas da escola</h2>
          <strong className={styles.loss}>{current.exited}</strong>
          <p>
            de {countLabel(current.base, ["aluno na base", "alunos na base"])} no fim de{" "}
            {current.previous}
          </p>
        </div>
        <div
          className={styles.ring}
          role="img"
          aria-label={`Permanência: ${percentage(stayed, current.base)}. ${stayed} permaneceram, ${current.exited} saíram e ${current.pending} aguardam confirmação.`}
        >
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <PieChart>
              <Pie
                data={[{ count: stayed }, { count: current.exited }, { count: current.pending }]}
                dataKey="count"
                innerRadius="77%"
                outerRadius="98%"
                startAngle={90}
                endAngle={-270}
                stroke="none"
                isAnimationActive={false}
              >
                <Cell fill={retained} />
                <Cell fill={exits} />
                <Cell fill="var(--muted-foreground)" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div>
            <strong>{percentage(stayed, current.base)}</strong>
            <span>permanência</span>
          </div>
        </div>
      </div>
      <div className={styles.foot}>
        <strong>{countLabel(stayed, ["permaneceu", "permaneceram"])}</strong>
        {current.pending > 0 && <span>{current.pending} sem confirmação</span>}
        <span>
          {countLabel(current.transferred, ["transferência interna", "transferências internas"])}
        </span>
      </div>
    </section>
  );
}
function RenewalPanel({
  current,
  history,
  select,
  cutoff,
  today,
  setThrough,
}: HistoryProps & {
  cutoff: string;
  today: string;
  setThrough: (value: string) => void;
}): ReactElement {
  return (
    <ChartPanel
      title="Renovação contratual"
      note={`Vencimentos de ${current.period} · corte em ${formatDateOnlyBR(cutoff)}`}
    >
      <div className={styles.renewed}>
        <strong>{percentage(current.renewed, current.due)}</strong>
        <p>
          {current.due
            ? `${current.renewed} de ${current.due} alunos com vencimento renovaram.`
            : "Nenhum aluno com contrato vencendo neste recorte."}
        </p>
      </div>
      <label className={styles.field}>
        Renovações até
        <input
          type="date"
          value={cutoff}
          max={today}
          onChange={(event) => {
            if (event.target.validity.valid) setThrough(event.target.value);
          }}
        />
      </label>
      {history.some((row) => row.due > 0) && (
        <HistoryChart rows={history} selected={current.id} select={select} kind="renewal" />
      )}
    </ChartPanel>
  );
}
function RetentionDetail({
  current,
  history,
  select,
  expanded,
}: HistoryProps & { expanded: boolean }): ReactElement {
  return (
    <details className={styles.detail} key={String(expanded)} open={expanded}>
      <summary>Conferir bases e critérios</summary>
      <section className={styles.exitDetail}>
        <h3>Como ocorreram as saídas</h3>
        <div className={styles.breakdown}>
          {[
            ["Rescisão contratual", current.terminated],
            ["Outras saídas registradas", current.exited - current.terminated],
          ].map(([label, count]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{count}</strong>
            </div>
          ))}
        </div>
        {current.exited > 0 && (
          <p>Motivo não informado em {countLabel(current.exited, ["saída", "saídas"])}.</p>
        )}
      </section>
      <p>
        Quem muda de turma permanece na escola. O vencimento por si só mantém o contrato em aberto.
        Cada aluno conta uma vez por período. Uma renovação vinculada a qualquer contrato vencido
        conta na virada de origem.
      </p>
      <p>
        Quem terminou o semestre anterior fica na base. Sem matrícula no destino, contrato vigente
        na data de referência ou saída registrada, o desfecho fica sem confirmação. Quem entrou no
        semestre de destino aparece à parte. O professor é o titular no fim do período consultado ou
        hoje, se o semestre está em andamento. Para quem saiu, vale a última turma. Turmas
        simultâneas podem aparecer em mais de um grupo. A idade é a da abertura do período.
      </p>
      <div className={styles.tableWrap}>
        <table>
          <caption>Valores por virada</caption>
          <thead>
            <tr>
              <th>Virada</th>
              <th>Base</th>
              <th>Saídas</th>
              <th>Permaneceram</th>
              <th>Sem confirmação</th>
              <th>Renovaram / venceram</th>
            </tr>
          </thead>
          <tbody>
            {history.map((row) => (
              <tr key={row.id}>
                <th>
                  <button onClick={() => select(row.id)}>{periodLabel(row)}</button>
                </th>
                <td>{row.base}</td>
                <td>{row.exited}</td>
                <td>{row.base - row.exited - row.pending}</td>
                <td>{row.pending}</td>
                <td>
                  {row.renewed} / {row.due}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
function HistoryPoints({
  rows,
  selected,
  select,
  kind,
}: {
  rows: Retention[];
  selected: string;
  select: (id: string) => void;
  kind: "renewal" | "exit";
}): ReactElement {
  return (
    <div
      className={styles.points}
      aria-label={
        kind === "renewal" ? "Selecionar virada por renovação" : "Selecionar período por saídas"
      }
    >
      {rows.map((row) => (
        <button key={row.id} aria-pressed={row.id === selected} onClick={() => select(row.id)}>
          <span>{row.period}</span>
          <strong>{kind === "renewal" ? percentage(row.renewed, row.due) : exitValue(row)}</strong>
        </button>
      ))}
    </div>
  );
}

function historyAxes(kind: "renewal" | "exit"): ReactElement {
  return (
    <>
      <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
      <XAxis {...axis} dataKey="period" minTickGap={12} />
      <YAxis
        {...axis}
        width={36}
        domain={kind === "renewal" ? [0, PERCENT_SCALE] : [0, "auto"]}
        allowDecimals={false}
        unit={kind === "renewal" ? "%" : ""}
      />
      <Tooltip
        contentStyle={TOOLTIP_STYLE}
        formatter={(value) => [
          kind === "renewal" ? `${numberLabel(Number(value))}%` : value,
          kind === "renewal" ? "Renovação" : "Saídas",
        ]}
      />
    </>
  );
}
function ExitHistory({ current, history, select }: HistoryProps): ReactElement {
  return (
    <ChartPanel
      title="Saídas por período"
      note="Alunos da base anterior com saída registrada no semestre de destino."
    >
      {history.some((row) => row.base > 0) ? (
        <HistoryChart rows={history} selected={current.id} select={select} kind="exit" />
      ) : (
        <p>A série começa na primeira virada com alunos na base anterior.</p>
      )}
    </ChartPanel>
  );
}

function exitValue(row: Retention): string | number {
  return row.base ? row.exited : "Sem base";
}
