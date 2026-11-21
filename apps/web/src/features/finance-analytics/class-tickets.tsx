"use client";
import { useState } from "react";
import { Input } from "@lazuli/ui";
import { formatBRLFromCents } from "~/lib/format";
import { trpc } from "~/lib/trpc";
import { QueryNotice } from "./query-notice";
import { AnalyticsFilters } from "./analytics-filters";
import styles from "./operations.module.css";
import type { RouterOutputs } from "@lazuli/api";
import type { ReactElement } from "react";

export function ClassTickets({ year }: { year: number }): ReactElement {
  const first = `${year}-01-01`,
    last = `${year}-12-31`;
  const [selectedDate, setDate] = useState("");
  const [filter, setFilter] = useState("");
  const query = trpc.dashboard.classTickets.useQuery({
    year,
    ...(selectedDate ? { date: selectedDate } : {}),
  });
  const date = selectedDate || query.data?.date || "";
  const rows = query.data?.rows.filter((row) =>
    row.name.toLocaleLowerCase("pt-BR").includes(filter.trim().toLocaleLowerCase("pt-BR")),
  );
  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <div>
          <h2>Ticket médio por turma</h2>
          <p>Mensalidades contratuais com bolsa aplicada, divididas pelos alunos ativos na data.</p>
        </div>
        <AnalyticsFilters label="Filtros">
          <label>
            Turma
            <Input value={filter} onChange={(event) => setFilter(event.target.value)} />
          </label>
          <label>
            Data de referência
            <Input
              type="date"
              value={date}
              min={first}
              max={last}
              onChange={(event) => {
                if (event.target.validity.valid && event.target.value) setDate(event.target.value);
              }}
            />
          </label>
        </AnalyticsFilters>
      </header>
      {date && (
        <p>
          Posição em {date.split("-").toReversed().join("/")}
          {filter && ` · Turma: ${filter}`}
        </p>
      )}
      {rows ? (
        rows.length > 0 ? (
          <TicketTable rows={rows} />
        ) : (
          <p>Nenhuma turma neste recorte. Consulte outra data ou ajuste a busca em Filtros.</p>
        )
      ) : (
        <QueryNotice failed={query.isError} retry={() => void query.refetch()} />
      )}
    </section>
  );
}

function TicketTable({
  rows,
}: {
  rows: RouterOutputs["dashboard"]["classTickets"]["rows"];
}): ReactElement {
  const active = rows.reduce((sum, row) => sum + row.active, 0);
  const cents = rows.reduce((sum, row) => sum + row.cents, 0);
  const missing = rows.reduce((sum, row) => sum + row.missing, 0);

  return (
    <div className={styles.scroll}>
      <table>
        <thead>
          <tr>
            <th>Turma</th>
            <th>Ocupação</th>
            <th>Mensalidades</th>
            <th>Ticket mensal</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <th>{row.name}</th>
              <td>
                {row.active} / {row.capacity}
              </td>
              <td>{row.missing ? "—" : formatBRLFromCents(row.cents)}</td>
              <td>
                {row.missing ? (
                  <span className={styles.warning}>{row.missing} sem valor atribuível</span>
                ) : (
                  ticketAverage(row)
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th>Turmas exibidas</th>
            <td>{active} matrículas</td>
            <td>{missing ? "—" : formatBRLFromCents(cents)}</td>
            <td>{active && !missing ? formatBRLFromCents(Math.round(cents / active)) : "—"}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function ticketAverage(row: RouterOutputs["dashboard"]["classTickets"]["rows"][number]): string {
  return row.active ? formatBRLFromCents(Math.round(row.cents / row.active)) : "—";
}
