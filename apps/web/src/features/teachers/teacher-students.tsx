"use client";
import { useState, type ReactElement } from "react";
import Link from "next/link";
import {
  ArrowDownNarrowWide,
  ArrowDownWideNarrow,
  ArrowUpRight,
  BookOpen,
  HeartPulse,
  Users,
} from "lucide-react";
import type { RouterOutputs } from "@lazuli/api";
import { Avatar, Badge, Button, EmptyState, Input } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { metricNumber } from "./teacher-metric-details";
import { TeacherStudentsLoading } from "./teacher-students-loading";
import styles from "./teacher-students.module.css";

type Student = RouterOutputs["teachers"]["metrics"]["students"][number];
const LEVELS = {
  HEALTHY: { label: "Saudável", variant: "success" },
  ATTENTION: { label: "Em atenção", variant: "warning" },
  PRIORITY: { label: "Prioridade", variant: "destructive" },
  INSUFFICIENT_DATA: { label: "Sem dados suficientes", variant: "neutral" },
} as const;

export function TeacherStudents({ id }: { id: string }): ReactElement {
  const query = trpc.teachers.metrics.useQuery(
    { id },
    { staleTime: 60_000, refetchOnWindowFocus: false },
  );
  const [search, setSearch] = useState("");
  const [highestFirst, setHighestFirst] = useState(false);
  const data = query.data;
  const normalized = (value: string): string =>
    value
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLocaleLowerCase("pt-BR");
  const groups = data?.classes
    .map((group) => ({
      ...group,
      students: data.students
        .filter(
          (student) =>
            group.studentIds.includes(student.id) &&
            normalized(student.name).includes(normalized(search)),
        )
        .toSorted((a, b) => {
          if (a.score === null && b.score !== null) return 1;
          if (b.score === null && a.score !== null) return -1;
          const difference = (a.score ?? 0) - (b.score ?? 0);
          return (highestFirst ? -difference : difference) || a.name.localeCompare(b.name, "pt-BR");
        }),
    }))
    .filter((group) => group.students.length > 0);
  return (
    <section className={styles.directory} aria-label="Alunos do professor">
      <header className={styles.heading}>
        <div className={styles.headingTitle}>
          <h2>
            <Users aria-hidden="true" />
            Alunos por turma
          </h2>
          <p>{data ? `${data.studentCount} alunos` : "Carregando…"}</p>
        </div>
        <div className={styles.headingControls}>
          <Input
            type="search"
            size="sm"
            aria-label="Buscar aluno pelo nome"
            placeholder="Buscar aluno"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setHighestFirst((value) => !value)}
            aria-label={`Ordenar por score: ${highestFirst ? "maior" : "menor"} primeiro. Alterar para ${highestFirst ? "menor" : "maior"} primeiro`}
            title={`Mostrar ${highestFirst ? "menores" : "maiores"} scores primeiro`}
          >
            {highestFirst ? <ArrowDownWideNarrow /> : <ArrowDownNarrowWide />}
            {highestFirst ? "Maior score" : "Menor score"}
          </Button>
        </div>
      </header>
      {query.isError && (
        <div role="alert" className={styles.error}>
          <p>Não foi possível atualizar os alunos.</p>
          <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
            Tentar novamente
          </Button>
        </div>
      )}
      {!data && !query.isError && <TeacherStudentsLoading />}
      {groups?.map((group) => (
        <section key={group.id} className={styles.classGroup} aria-label={group.name}>
          <header className={styles.classHeading}>
            <div>
              <BookOpen aria-hidden="true" />
              <h3>
                <Link href={`/turmas/${group.id}`}>{group.name}</Link>
              </h3>
              <span>
                {group.students.length} {group.students.length === 1 ? "aluno" : "alunos"}
              </span>
            </div>
            <p>
              Score médio <strong>{metricNumber(group.score)}</strong>
              <span>de 100</span>
            </p>
          </header>
          <ul className={styles.students}>
            {group.students.map((student) => (
              <StudentItem key={student.id} student={student} />
            ))}
          </ul>
        </section>
      ))}
      {data && !groups?.length && (
        <EmptyState
          title={search ? "Nenhum aluno encontrado" : "Nenhum aluno nas turmas atuais"}
          description={
            search
              ? "Tente outro nome."
              : "Os alunos aparecerão aqui conforme as matrículas forem vinculadas."
          }
        />
      )}
    </section>
  );
}

function StudentItem({ student }: { student: Student }): ReactElement {
  const level = LEVELS[student.level];
  return (
    <li>
      <Link
        className={styles.student}
        href={`/alunos/${student.id}?secao=pedagogico`}
        aria-label={`Abrir perfil de ${student.name}`}
      >
        <div className={styles.identity}>
          <Avatar name={student.name} colorKey={student.id} size="lg" />
          <div>
            <strong className={styles.studentName}>
              {student.name}
              <ArrowUpRight aria-hidden="true" />
            </strong>
            <Badge variant={level.variant}>{level.label}</Badge>
          </div>
          <div
            className={styles.score}
            data-level={student.level}
            title="Score individual, de 0 a 100"
          >
            <HeartPulse aria-hidden="true" />
            <strong>{metricNumber(student.score)}</strong>
            <span>score individual</span>
          </div>
        </div>
        <dl className={styles.facts}>
          <div>
            <dt>Média das notas</dt>
            <dd>{student.grades === null ? "Sem notas" : metricNumber(student.grades)}</dd>
          </div>
          <div>
            <dt>Faltas</dt>
            <dd>
              {student.attendance.percent === null
                ? "Sem chamada"
                : `${metricNumber(student.attendance.percent)}%`}
            </dd>
          </div>
          <div data-attention={student.pending > 0 || undefined}>
            <dt>Ocorrências abertas</dt>
            <dd>{student.pending}</dd>
          </div>
        </dl>
        <p className={styles.evidence}>
          {student.availableIndicators} de 4 indicadores disponíveis · {student.healthHeldSessions}{" "}
          aulas no score
        </p>
      </Link>
    </li>
  );
}
