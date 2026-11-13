"use client";
import { StudentAvatar } from "~/components/student-avatar";
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
import { Badge, Button, EmptyState, Input } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { metricNumber } from "./teacher-metric-details";
import { TeacherStudentsLoading } from "./teacher-students-loading";
import styles from "./teacher-students.module.css";

type Metrics = RouterOutputs["teachers"]["metrics"];
type StudentGroup = Metrics["classes"][number] & { students: Student[] };
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
  const groups = groupStudents(data, { search, highestFirst });
  return (
    <section className={styles.directory} aria-label="Alunos do professor">
      <StudentsHeader
        search={search}
        highestFirst={highestFirst}
        count={data?.studentCount}
        onSearch={setSearch}
        onOrder={() => setHighestFirst((value) => !value)}
      />
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
        <StudentsGroup key={group.id} group={group} />
      ))}
      {data && !groups?.length && <StudentsEmpty search={search} />}
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
          <StudentAvatar name={student.name} colorKey={student.id} size="lg" />
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

function normalized(value: string): string {
  return value
    .normalize("NFD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR");
}
function groupStudents(
  data: Metrics | undefined,
  { search, highestFirst }: { search: string; highestFirst: boolean },
): StudentGroup[] | undefined {
  return data?.classes
    .map((group) => ({
      ...group,
      students: data.students
        .filter(
          (student) =>
            group.studentIds.includes(student.id) &&
            normalized(student.name).includes(normalized(search)),
        )
        .toSorted((left, right) => {
          if (left.score === null && right.score !== null) return 1;
          if (right.score === null && left.score !== null) return -1;
          const difference = (left.score ?? 0) - (right.score ?? 0);
          return (
            (highestFirst ? -difference : difference) ||
            left.name.localeCompare(right.name, "pt-BR")
          );
        }),
    }))
    .filter((group) => group.students.length > 0);
}

function StudentsHeader({
  search,
  highestFirst,
  count,
  onSearch,
  onOrder,
}: {
  search: string;
  highestFirst: boolean;
  count: number | undefined;
  onSearch: (value: string) => void;
  onOrder: () => void;
}): ReactElement {
  return (
    <header className={styles.heading}>
      <div className={styles.headingTitle}>
        <h2>
          <Users aria-hidden="true" />
          Alunos por turma
        </h2>
        <p>{count === undefined ? "Carregando…" : `${count} alunos`}</p>
      </div>
      <div className={styles.headingControls}>
        <Input
          type="search"
          size="sm"
          aria-label="Buscar aluno pelo nome"
          placeholder="Buscar aluno"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={onOrder}
          aria-label={`Ordenar por score: ${highestFirst ? "maior" : "menor"} primeiro. Alterar para ${highestFirst ? "menor" : "maior"} primeiro`}
          title={`Mostrar ${highestFirst ? "menores" : "maiores"} scores primeiro`}
        >
          {highestFirst ? <ArrowDownWideNarrow /> : <ArrowDownNarrowWide />}
          {highestFirst ? "Maior score" : "Menor score"}
        </Button>
      </div>
    </header>
  );
}

function StudentsGroup({ group }: { group: StudentGroup }): ReactElement {
  return (
    <section className={styles.classGroup} aria-label={group.name}>
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
  );
}

function StudentsEmpty({ search }: { search: string }): ReactElement {
  return (
    <EmptyState
      title={search ? "Nenhum aluno encontrado" : "Nenhum aluno nas turmas atuais"}
      description={
        search
          ? "Tente outro nome."
          : "Os alunos aparecerão aqui conforme as matrículas forem vinculadas."
      }
    />
  );
}
