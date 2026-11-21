"use client";
import { useState } from "react";
import { AnalyticsRecords } from "../finance-analytics/analytics-records";
import Link from "next/link";
import { trpc } from "~/lib/trpc";
import { formatAttendancePercent } from "~/lib/format";
import { AnalyticsFilters } from "../finance-analytics/analytics-filters";
import { AttendanceTrend } from "../finance-analytics/attendance-trend";
import { QueryNotice } from "../finance-analytics/query-notice";
import styles from "../finance-analytics/operations.module.css";
import type { RouterOutputs } from "@lazuli/api";
import type { ReactElement } from "react";
const MONTH_DAYS = 30;
const QUARTER_DAYS = 90;
const HALF_YEAR_DAYS = 180;

export function TeacherAnalytics(): ReactElement {
  const [days, setDays] = useState<PeriodDays>(MONTH_DAYS);
  const [group, setGroup] = useState({ id: "", name: "" });
  const query = trpc.teacherWorkspace.analytics.useQuery({ days });
  const trend = trpc.teacherWorkspace.weeklyAttendance.useQuery({ days });
  const classes = new Map(query.data?.map((row) => [row.classId, row.className]));
  const selected = group.id;
  if (selected && !classes.has(selected)) classes.set(selected, group.name);
  const rows = query.data?.filter((row) => !selected || row.classId === selected);
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Analytics dos meus alunos</h1>
        <TeacherFilters
          days={days}
          setDays={setDays}
          selected={selected}
          classes={classes}
          setGroup={setGroup}
        />
      </header>
      <section className={styles.panel}>
        <h2>{classes.get(selected) ?? "Frequência nas minhas aulas"}</h2>
        <p>Alunos das suas turmas e chamadas confirmadas nas aulas que você ministrou.</p>
        {rows ? (
          rows.length > 0 ? (
            <>
              <TeacherSummary rows={rows} />
              {trend.data ? (
                <AttendanceTrend rows={trend.data} group={selected} />
              ) : (
                <QueryNotice failed={trend.isError} retry={() => void trend.refetch()} />
              )}
              <TeacherRoster key={selected + days} rows={rows} />
            </>
          ) : (
            <p>Sem chamadas confirmadas neste período. Consulte um intervalo maior nos filtros.</p>
          )
        ) : (
          <QueryNotice failed={query.isError} retry={() => void query.refetch()} />
        )}
      </section>
    </div>
  );
}

function TeacherRoster({
  rows,
}: {
  rows: RouterOutputs["teacherWorkspace"]["analytics"];
}): ReactElement {
  return (
    <AnalyticsRecords
      label="Frequência dos meus alunos"
      rows={rows.map((row) => ({ ...row, id: row.studentId + row.classId }))}
      columns={[
        {
          id: "student",
          header: "Aluno",
          width: "wide",
          cell: (row) => (
            <Link
              className="text-interactive hover:underline"
              href={`/professor/alunos/${row.studentId}`}
            >
              {row.name}
            </Link>
          ),
        },
        { id: "class", header: "Turma", cell: (row) => row.className },
        {
          id: "absent",
          header: "Faltas",
          numeric: true,
          cell: (row) => (
            <span className={row.absent ? styles.warning : undefined}>{row.absent}</span>
          ),
        },
        {
          id: "rate",
          header: "Frequência",
          numeric: true,
          cell: (row) =>
            formatAttendancePercent(
              row.present + row.absent ? row.present / (row.present + row.absent) : null,
            ),
        },
      ]}
    />
  );
}

function TeacherSummary({
  rows,
}: {
  rows: RouterOutputs["teacherWorkspace"]["analytics"];
}): ReactElement {
  const present = rows.reduce((count, row) => count + row.present, 0);
  const absent = rows.reduce((count, row) => count + row.absent, 0);
  const students = new Set(rows.map((row) => row.studentId)).size;
  return (
    <>
      <strong className={styles.attendanceValue}>
        {formatAttendancePercent(present + absent ? present / (present + absent) : null)}
      </strong>
      <p>
        {students} {students === 1 ? "aluno" : "alunos"} · {present} presenças · {absent} faltas
      </p>
    </>
  );
}

type PeriodDays = typeof MONTH_DAYS | typeof QUARTER_DAYS | typeof HALF_YEAR_DAYS;
function TeacherFilters({
  days,
  setDays,
  selected,
  classes,
  setGroup,
}: {
  days: PeriodDays;
  setDays: (value: PeriodDays) => void;
  selected: string;
  classes: Map<string, string>;
  setGroup: (value: { id: string; name: string }) => void;
}): ReactElement {
  return (
    <AnalyticsFilters label={`Últimos ${days} dias`}>
      <label>
        Período
        <select
          value={days}
          onChange={(event) => setDays(Number(event.target.value) as PeriodDays)}
        >
          {[MONTH_DAYS, QUARTER_DAYS, HALF_YEAR_DAYS].map((count) => (
            <option key={count} value={count}>
              Últimos {count} dias
            </option>
          ))}
        </select>
      </label>
      <label>
        Turma
        <select
          value={selected}
          onChange={(event) =>
            setGroup({ id: event.target.value, name: classes.get(event.target.value) ?? "" })
          }
        >
          <option value="">Todas as minhas turmas</option>
          {[...classes].map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </label>
    </AnalyticsFilters>
  );
}
