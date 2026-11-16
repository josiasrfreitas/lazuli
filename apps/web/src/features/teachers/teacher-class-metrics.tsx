"use client";
import { useState, type ReactElement } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  CalendarCheck,
  ChevronDown,
  HeartPulse,
  History,
  Users,
} from "lucide-react";
import { Badge, Button, EmptyState } from "@lazuli/ui";
import type { RouterOutputs } from "@lazuli/api";
import { trpc } from "~/lib/trpc";
import { metricNumber } from "./teacher-metric-details";
import { TeacherClasses } from "./teacher-classes";
import { TeacherClassMetricsLoading } from "./teacher-class-metrics-loading";
import {
  orderTeacherClasses,
  filterTeacherClasses,
  type TeacherClassFilters,
  type TeacherClassOrder,
  type TeacherClassDirection,
  type TeacherMetricClass,
} from "./teacher-class-order";
import styles from "./teacher-class-metrics.module.css";

type Metrics = RouterOutputs["teachers"]["metrics"];
type Student = RouterOutputs["teachers"]["metrics"]["students"][number];

export function TeacherClassMetrics({
  id,
  back,
  order,
  direction,
  filters,
  onClearFilters,
}: {
  id: string;
  back: string;
  order: TeacherClassOrder;
  direction: TeacherClassDirection;
  filters: TeacherClassFilters;
  onClearFilters: () => void;
}): ReactElement {
  const query = trpc.teachers.metrics.useQuery(
    { id },
    { staleTime: 60_000, refetchOnWindowFocus: false },
  );
  const [allLinks, setAllLinks] = useState(false);
  const data = query.data;
  const rows = directoryRows(data, { filters, order, direction });
  const filtered = Boolean(filters.type || filters.attention);
  return (
    <section className={styles.directory} aria-label="Indicadores das turmas atuais">
      <ClassDirectoryHeading data={data} filtered={filtered} count={rows.length} />
      {query.isError && (
        <div role="alert" className={styles.error}>
          <p>Não foi possível atualizar os indicadores das turmas.</p>
          <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
            Tentar novamente
          </Button>
        </div>
      )}
      {!data && !query.isError && <TeacherClassMetricsLoading />}
      {data && (
        <ClassDirectoryRows
          data={data}
          rows={rows}
          order={order}
          back={back}
          onClearFilters={onClearFilters}
        />
      )}
      {data && rows.length > 0 && (
        <p className={styles.note}>
          O score é a média dos alunos com dados. Indicadores indisponíveis ficam no fim da
          ordenação.
        </p>
      )}
      <div className={styles.history}>
        <Button
          size="sm"
          variant="ghost"
          aria-expanded={allLinks}
          aria-controls={`teacher-links-${id}`}
          onClick={() => setAllLinks((value) => !value)}
        >
          <History aria-hidden="true" />
          Todos os vínculos
          <ChevronDown aria-hidden="true" className={allLinks ? "rotate-180" : "rotate-0"} />
        </Button>
        <span>Inclui turmas anteriores e programadas</span>
      </div>
      {allLinks && (
        <div id={`teacher-links-${id}`}>
          <TeacherClasses teacherId={id} back={back} />
        </div>
      )}
    </section>
  );
}

function ClassMetricCard({
  row,
  students,
  order,
  back,
}: {
  row: TeacherMetricClass;
  students: Student[];
  order: TeacherClassOrder;
  back: string;
}): ReactElement {
  const covered = students.filter((student) => student.score !== null).length;
  const attention = students.filter((student) => student.level === "ATTENTION").length;
  const priority = students.filter((student) => student.level === "PRIORITY").length;
  return (
    <li>
      <Link
        className={styles.card}
        href={`/turmas/${row.id}?voltar=${encodeURIComponent(back)}`}
        aria-label={`Abrir turma ${row.name}`}
      >
        <header className={styles.identity}>
          <div>
            <BookOpen aria-hidden="true" />
            <h3>{row.name}</h3>
          </div>
          <ArrowUpRight aria-hidden="true" className={styles.openIcon} />
        </header>
        <ClassCohort row={row} attention={attention} priority={priority} />
        <ClassReadings row={row} order={order} covered={covered} />
        <footer className={styles.calls}>
          <span>Chamadas confirmadas</span>
          <strong>
            {row.calls.due ? (
              <>
                {row.calls.confirmed}
                <span> / {row.calls.due}</span>
              </>
            ) : (
              <span>Nenhuma aula realizada</span>
            )}
          </strong>
        </footer>
      </Link>
    </li>
  );
}

function ClassDirectoryRows({
  data,
  rows,
  order,
  back,
  onClearFilters,
}: {
  data: Metrics;
  rows: TeacherMetricClass[];
  order: TeacherClassOrder;
  back: string;
  onClearFilters: () => void;
}): ReactElement {
  if (rows.length > 0)
    return (
      <ul className={styles.grid}>
        {rows.map((row) => (
          <ClassMetricCard
            key={row.id}
            row={row}
            students={data.students.filter((student) => row.studentIds.includes(student.id))}
            order={order}
            back={back}
          />
        ))}
      </ul>
    );
  if (data.classes.length > 0)
    return (
      <EmptyState
        title="Nenhuma turma com esses filtros"
        description="Experimente outro tipo de turma ou remova o filtro de atenção."
        action={
          <Button variant="secondary" size="sm" onClick={onClearFilters}>
            Limpar filtros
          </Button>
        }
      />
    );
  return (
    <EmptyState
      title="Nenhuma turma atual"
      description="As estatísticas aparecem quando houver uma turma sob responsabilidade deste professor no semestre atual. Vínculos anteriores e programados continuam disponíveis abaixo."
    />
  );
}

function ClassCohort({
  row,
  attention,
  priority,
}: {
  row: TeacherMetricClass;
  attention: number;
  priority: number;
}): ReactElement {
  return (
    <div className={styles.cohort}>
      <span>
        <Users aria-hidden="true" />
        {row.studentCount} {row.studentCount === 1 ? "aluno" : "alunos"}
      </span>
      <Badge variant="neutral">{row.scheduleType === "PERSONALIZED" ? "PPT" : "Regular"}</Badge>
      {attention > 0 && (
        <Badge variant="warning">
          {attention} {attention === 1 ? "aluno em atenção" : "alunos em atenção"}
        </Badge>
      )}
      {priority > 0 && (
        <Badge variant="destructive">
          {priority} {priority === 1 ? "aluno em prioridade" : "alunos em prioridade"}
        </Badge>
      )}
    </div>
  );
}

function ClassReadings({
  row,
  order,
  covered,
}: {
  row: TeacherMetricClass;
  order: TeacherClassOrder;
  covered: number;
}): ReactElement {
  return (
    <dl className={styles.metrics}>
      <div data-emphasis={order === "score" || undefined}>
        <dt>
          <HeartPulse aria-hidden="true" />
          Score médio
        </dt>
        <dd data-empty={row.score === null || undefined}>
          {row.score === null ? "Sem score" : metricNumber(row.score)}
        </dd>
        <dd className={styles.evidence}>
          {covered} de {row.studentCount} com dados
        </dd>
      </div>
      <div data-emphasis={order === "grades" || undefined}>
        <dt>
          <BookOpen aria-hidden="true" />
          Média das notas
        </dt>
        <dd data-empty={row.grades === null || undefined}>
          {row.grades === null ? "Sem notas" : metricNumber(row.grades)}
        </dd>
        <dd className={styles.evidence}>Escala de 0 a 100</dd>
      </div>
      <div data-emphasis={order === "absence" || undefined}>
        <dt>
          <CalendarCheck aria-hidden="true" />
          Faltas
        </dt>
        <dd data-empty={row.attendance.percent === null || undefined}>
          {row.attendance.percent === null
            ? "Sem chamada"
            : `${metricNumber(row.attendance.percent)}%`}
        </dd>
        <dd className={styles.evidence}>Faltas registradas</dd>
      </div>
    </dl>
  );
}

function ClassDirectoryHeading({
  data,
  filtered,
  count,
}: {
  data: Metrics | undefined;
  filtered: boolean;
  count: number;
}): ReactElement {
  return (
    <header className={styles.summary}>
      <h2>
        Turmas atuais
        {data && (
          <span aria-live="polite"> {filtered ? `${count} de ${data.classes.length}` : count}</span>
        )}
      </h2>
      <p>Notas e faltas no período de atuação do professor.</p>
    </header>
  );
}

function directoryRows(
  data: Metrics | undefined,
  {
    filters,
    order,
    direction,
  }: { filters: TeacherClassFilters; order: TeacherClassOrder; direction: TeacherClassDirection },
): TeacherMetricClass[] {
  return data
    ? orderTeacherClasses(
        filterTeacherClasses(data.classes, { students: data.students, filters }),
        { order, direction },
      )
    : [];
}
