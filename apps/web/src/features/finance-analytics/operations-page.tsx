"use client";
import { useState } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { SegmentedControl, SegmentedControlItem } from "@lazuli/ui";
import { leadSourceLabels } from "@lazuli/validators";
import { trpc } from "~/lib/trpc";
import { formatAttendancePercent, toDateOnlySaoPaulo } from "~/lib/format";
import { SchoolAttendanceTrend } from "./attendance-trend";
import { PlacementDemand } from "./placement-demand";
import { EnrollmentProduction } from "./enrollment-production";
import { AnalyticsSections } from "./analytics-sections";
import { ContractClosings } from "./contract-closings";
import { AnalyticsFilters } from "./analytics-filters";
import styles from "./operations.module.css";

import { QueryNotice } from "./query-notice";
import type { RouterOutputs } from "@lazuli/api";
import type { ReactElement } from "react";
const YEAR_DIGITS = 4;
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;
const THIRD_QUARTER = 3;
const FOURTH_QUARTER = 4;
const PERCENT_SCALE = 100;
const percent = (count: number, base: number): string =>
  formatAttendancePercent(base ? count / base : null);
export function OperationsPage({ area }: { area: "comercial" | "pedagogico" }): ReactElement {
  const [tab, setTab] = useState(area === "comercial" ? "leads" : "retention");
  const current = Number(toDateOnlySaoPaulo(new Date()).slice(0, YEAR_DIGITS));
  const [year, setYear] = useState(current);
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Analytics {area === "comercial" ? "comercial" : "pedagógico"}</h1>
        <label>
          Ano{" "}
          <input
            type="number"
            min={2000}
            max={2100}
            key={year}
            defaultValue={year}
            onBlur={(event) => {
              const count = event.target.valueAsNumber;
              if (Number.isInteger(count) && count >= MIN_YEAR && count <= MAX_YEAR) {
                setYear(count);
                if (tab === "places" && count !== current) setTab("retention");
              } else event.target.value = String(year);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
          />
        </label>
      </header>
      <AnalyticsSections
        active={tab}
        setActive={setTab}
        sections={
          area === "comercial"
            ? { leads: "Leads e matrículas", contracts: "Fechamentos" }
            : {
                retention: "Retenção",
                classes: "Turmas e frequência",
                ...(year === current ? { places: "Espera e vagas" } : {}),
              }
        }
      />
      {tab === "contracts" && <ContractClosings year={year} />}
      {tab === "leads" && (
        <>
          <LeadPanel year={year} />
          <EnrollmentProduction key={year} year={year} />
        </>
      )}
      {tab === "retention" && <Retention key={year} year={year} />}
      {tab === "classes" && (
        <>
          <SchoolAttendanceTrend key={year} year={year} />
          <TeachingActivity year={year} />
        </>
      )}
      {tab === "places" && <PlacementDemand />}
    </div>
  );
}
function LeadPanel({ year }: { year: number }): ReactElement {
  const [quarter, setQuarter] = useState(0);
  const query = trpc.dashboard.leadPerformance.useQuery({ year, ...(quarter ? { quarter } : {}) });
  const [dimension, setDimension] = useState("source");
  const groups = groupLeads(query.data, dimension);
  const leads = [...groups.values()].reduce((count, row) => count + row.leads, 0);
  const enrolled = [...groups.values()].reduce((count, row) => count + row.enrolled, 0);
  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <div>
          <h2>Conversão em matrícula</h2>
          <p>
            Leads cadastrados {quarter ? `no ${quarter}º trimestre de` : "em"} {year} que chegaram à
            matrícula até hoje.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            size="sm"
            aria-label="Agrupar conversão"
            value={dimension}
            onValueChange={(value) => {
              if (value) setDimension(value);
            }}
          >
            <SegmentedControlItem value="source">Origem</SegmentedControlItem>
            <SegmentedControlItem value="owner">Responsável atual</SegmentedControlItem>
          </SegmentedControl>
          <AnalyticsFilters label={quarter ? `${quarter}º trimestre` : "Período"}>
            <label>
              Entrada dos leads
              <select value={quarter} onChange={(event) => setQuarter(Number(event.target.value))}>
                <option value={0}>Ano completo</option>
                {[1, 2, THIRD_QUARTER, FOURTH_QUARTER].map((count) => (
                  <option key={count} value={count}>
                    {count}º trimestre
                  </option>
                ))}
              </select>
            </label>
          </AnalyticsFilters>
        </div>
      </header>
      {query.data ? (
        <>
          {groups.size === 0 ? (
            <p>Nenhum lead cadastrado neste período.</p>
          ) : (
            <LeadRates groups={groups} dimension={dimension} leads={leads} enrolled={enrolled} />
          )}
        </>
      ) : (
        <QueryNotice failed={query.isError} retry={() => void query.refetch()} />
      )}
    </section>
  );
}
function Retention({ year }: { year: number }): ReactElement {
  const [origin, setOrigin] = useState("");
  const [through, setThrough] = useState("");
  const query = trpc.dashboard.schoolRetention.useQuery(
    {
      year,
      ...(origin ? { originClassId: origin } : {}),
      ...(through ? { through } : {}),
    },
    { placeholderData: keepPreviousData },
  );
  if (!query.data) return <QueryNotice failed={query.isError} retry={() => void query.refetch()} />;
  const { renewal: row, periods } = query.data;

  return (
    <>
      <section className={styles.panel}>
        <header className={styles.header}>
          <div>
            <h2>
              Rematrícula · {year - 1} → {year}
            </h2>
            <p>
              {query.data.origins.find((row) => row.id === origin)?.name ??
                "Todas as turmas de origem"}{" "}
              · até {query.data.cutoff.split("-").toReversed().join("/")}
            </p>
          </div>
          <AnalyticsFilters label="Filtros">
            <label>
              Turma de origem
              <select value={origin} onChange={(event) => setOrigin(event.target.value)}>
                <option value="">Todas as turmas</option>
                {query.data.origins.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Matrículas efetivadas até
              <input
                type="date"
                value={through || query.data.cutoff}
                max={[`${year}-12-31`, toDateOnlySaoPaulo(new Date())].toSorted()[0]}
                onChange={(event) => {
                  if (event.target.value && event.target.validity.valid)
                    setThrough(event.target.value);
                }}
              />
            </label>
          </AnalyticsFilters>
        </header>
        <p>
          Base de continuidade: alunos do ano anterior incluídos na formação de {year}, contados uma
          vez.
        </p>
        {query.isPlaceholderData ? (
          <QueryNotice failed={false} retry={() => void query.refetch()} />
        ) : (
          <RenewalBreakdown row={row} closed={query.data.cutoff === `${year}-12-31`} />
        )}
      </section>
      <SemesterChurn periods={periods} />
    </>
  );
}

function TeachingActivity({ year }: { year: number }): ReactElement {
  const query = trpc.dashboard.teachingActivity.useQuery({ year });
  const [pendingOnly, setPendingOnly] = useState(false);
  const rows = query.data?.filter((row) => !pendingOnly || row.pending > 0);
  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <div>
          <h2>Acompanhamento das turmas</h2>
          <p>
            Frequência nas chamadas confirmadas até ontem. Ocupação de hoje ou do último dia do
            semestre encerrado.
          </p>
        </div>
        <label>
          <input
            type="checkbox"
            checked={pendingOnly}
            onChange={(event) => setPendingOnly(event.target.checked)}
          />{" "}
          Só com chamada pendente
        </label>
      </header>
      {rows ? (
        rows.length > 0 ? (
          <TeachingTable rows={rows} />
        ) : (
          <p>Nenhuma turma neste recorte.</p>
        )
      ) : (
        <QueryNotice failed={query.isError} retry={() => void query.refetch()} />
      )}
    </section>
  );
}

function SemesterChurn({
  periods,
}: {
  periods: RouterOutputs["dashboard"]["schoolRetention"]["periods"];
}): ReactElement {
  return (
    <section className={styles.panel}>
      <h2>Evasão por semestre</h2>
      <p>
        Alunos ativos na abertura que desistiram e estavam sem matrícula ao final do período, ou até
        hoje.
      </p>
      {periods.length > 0 ? (
        <div className={styles.scroll}>
          <table>
            <thead>
              <tr>
                <th>Semestre</th>
                <th>Ativos na abertura</th>
                <th>Desistências</th>
                <th>Evasão</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((period) => (
                <tr key={period.id}>
                  <th>{period.name}</th>
                  <td>{period.base}</td>
                  <td>{period.lost}</td>
                  <td>{percent(period.lost, period.base)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>Sem alunos na base de abertura dos semestres deste ano.</p>
      )}
    </section>
  );
}

function LeadRates({
  groups,
  dimension,
  leads,
  enrolled,
}: {
  groups: Map<string, { label: string; leads: number; enrolled: number }>;
  dimension: string;
  leads: number;
  enrolled: number;
}): ReactElement {
  return (
    <div className={styles.scroll}>
      <p className={styles.summary}>
        <strong>{percent(enrolled, leads)}</strong> · {enrolled} matrículas em {leads} leads
      </p>
      <table>
        <thead>
          <tr>
            <th>{dimension === "source" ? "Origem" : "Responsável"}</th>
            <th>Leads (% do total)</th>
            <th>Matrículas</th>
            <th>Conversão</th>
          </tr>
        </thead>
        <tbody>
          {[...groups]
            .toSorted((left, right) => right[1].leads - left[1].leads)
            .map(([key, item]) => (
              <tr key={key}>
                <th>{item.label}</th>
                <td>
                  {item.leads}{" "}
                  <span className="text-caption text-muted-foreground">
                    ({percent(item.leads, leads)})
                  </span>
                </td>
                <td>{item.enrolled}</td>
                <td>
                  <div className={styles.rate}>
                    <meter
                      aria-label={`Conversão de ${item.label}`}
                      min={0}
                      max={item.leads}
                      value={item.enrolled}
                    />
                    {percent(item.enrolled, item.leads)}
                  </div>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

function groupLeads(
  rows: RouterOutputs["dashboard"]["leadPerformance"] | undefined,
  dimension: string,
): Map<string, { label: string; leads: number; enrolled: number }> {
  const groups = new Map<string, { label: string; leads: number; enrolled: number }>();
  for (const row of rows ?? []) {
    const source = dimension === "source";
    const key = (source ? row.source : row.ownerId) ?? "unknown";
    const sourceLabel = row.source ? leadSourceLabels[row.source] : "Origem não informada";
    const label = source ? sourceLabel : (row.owner ?? "Sem responsável");
    const group = groups.get(key) ?? { label, leads: 0, enrolled: 0 };
    group.leads += row.leads;
    group.enrolled += row.enrolled;
    groups.set(key, group);
  }
  return groups;
}

function RenewalBreakdown({
  row,
  closed,
}: {
  row: RouterOutputs["dashboard"]["schoolRetention"]["renewal"];
  closed: boolean;
}): ReactElement {
  const pending = row.eligible - row.renewed - row.declined;
  return row.eligible ? (
    <>
      <strong className={styles.headline}>{percent(row.renewed, row.eligible)}</strong>
      <p>
        {row.renewed} de {row.eligible} alunos com matrícula efetivada
      </p>
      <div className={styles.strip} aria-hidden="true">
        <svg width="100%" height="14" viewBox="0 0 100 1" preserveAspectRatio="none">
          <rect width="100" height="1" fill="var(--warning)" />
          <rect
            width={(PERCENT_SCALE * (row.renewed + row.declined)) / row.eligible}
            height="1"
            fill="var(--destructive)"
          />
          <rect
            width={(PERCENT_SCALE * row.renewed) / row.eligible}
            height="1"
            fill="var(--success)"
          />
        </svg>
      </div>
      <div className={styles.legend}>
        <span>Renovados · {row.renewed}</span>
        <span>Recusas · {row.declined}</span>
        <span>
          {closed ? "Sem confirmação" : "Pendentes"} · {pending}
        </span>
      </div>
      {closed && (
        <p>
          Não renovaram no ano: {percent(row.eligible - row.renewed, row.eligible)} (
          {row.eligible - row.renewed} alunos).
        </p>
      )}
    </>
  ) : (
    <p>Nenhum aluno na base de continuidade desta virada.</p>
  );
}

function TeachingTable({
  rows,
}: {
  rows: RouterOutputs["dashboard"]["teachingActivity"];
}): ReactElement {
  const totals = { active: 0, capacity: 0, present: 0, marked: 0, pending: 0 };
  for (const row of rows) {
    totals.active += row.active;
    totals.capacity += row.capacity;
    totals.present += row.present;
    totals.marked += row.marked;
    totals.pending += row.pending;
  }
  return (
    <div className={styles.scroll}>
      <table>
        <thead>
          <tr>
            <th>Turma</th>
            <th>Ocupação</th>
            <th>Frequência</th>
            <th>Chamadas pendentes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <th>{row.name}</th>
              <td>
                {row.active} / {row.capacity}
              </td>
              <td>{percent(row.present, row.marked)}</td>
              <td className={row.pending ? styles.warning : undefined}>{row.pending}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th>Turmas exibidas</th>
            <td>
              {totals.active} / {totals.capacity}
            </td>
            <td>{percent(totals.present, totals.marked)}</td>
            <td>{totals.pending}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
