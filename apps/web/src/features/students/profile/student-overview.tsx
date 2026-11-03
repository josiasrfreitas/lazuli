"use client";

import type { ReactElement } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  GraduationCap,
  NotebookPen,
  Pencil,
  CircleCheck,
} from "lucide-react";
import { Badge, Button, InlineSkeleton } from "@lazuli/ui";
import { formatDateOnlyBR } from "~/lib/format";
import { useStudentPedagogy, type StudentEnrollment, type StudentProfile } from "./logic";
import { StudentPendingActions } from "./student-pending-actions";
import { StudentNotes } from "./student-notes";
import { StudentHealth, StudentHealthLoading } from "./student-health";
import { ProfileError } from "./profile-shared";
import styles from "./student-overview.module.css";
import loading from "./student-loading.module.css";

type Navigate = (section: "pedagogico" | "financeiro") => void;
const DAYS: Record<string, string> = {
  MONDAY: "Seg",
  TUESDAY: "Ter",
  WEDNESDAY: "Qua",
  THURSDAY: "Qui",
  FRIDAY: "Sex",
  SATURDAY: "Sáb",
  SUNDAY: "Dom",
};
const WEEKDAYS = Object.keys(DAYS);

export function StudentOverview({
  profile,
  navigate,
}: {
  profile: StudentProfile;
  navigate: Navigate;
}): ReactElement {
  const pedagogy = useStudentPedagogy(profile.id);
  return (
    <div className={styles.overview}>
      <div className={styles.summaryGrid}>
        <OverviewMain profile={profile} navigate={navigate} pedagogy={pedagogy} />
        <div className={styles.healthColumn}>
          <StudentHealth studentId={profile.id} />
        </div>
      </div>
      <div className={styles.workGrid}>
        <StudentNotes profile={profile} />
        <StudentPendingActions studentId={profile.id} pedagogy={pedagogy} />
      </div>
    </div>
  );
}

function OverviewMain({
  profile,
  navigate,
  pedagogy,
}: {
  profile: StudentProfile;
  navigate: Navigate;
  pedagogy: ReturnType<typeof useStudentPedagogy>;
}): ReactElement {
  return (
    <div className={styles.mainColumn}>
      <section className={styles.enrollment} aria-labelledby="overview-enrollment-title">
        <header className={styles.sectionHeading}>
          <h2 id="overview-enrollment-title">Matrícula atual</h2>
          <Button variant="link" size="sm" onClick={() => navigate("pedagogico")}>
            Pedagógico <ArrowRight aria-hidden="true" />
          </Button>
        </header>
        <EnrollmentState pedagogy={pedagogy} studentId={profile.id} />
      </section>
    </div>
  );
}

function EnrollmentState({
  pedagogy,
  studentId,
}: {
  pedagogy: ReturnType<typeof useStudentPedagogy>;
  studentId: string;
}): ReactElement {
  if (pedagogy.isError) {
    return (
      <ProfileError
        message="Não foi possível carregar a matrícula."
        onRetry={() => void pedagogy.refetch()}
      />
    );
  }
  if (pedagogy.data) {
    return (
      <EnrollmentSummary
        rows={pedagogy.data.enrollments}
        today={pedagogy.data.today}
        studentId={studentId}
      />
    );
  }
  return <EnrollmentSummaryLoading />;
}

function EnrollmentSummary({
  rows,
  today,
  studentId,
}: {
  rows: StudentEnrollment[];
  today: string;
  studentId: string;
}): ReactElement {
  const current = rows.filter((row) => row.current);
  if (current.length === 0) {
    const next = rows
      .filter((row) => row.entryDate > today)
      .toSorted((first, second) => first.entryDate.localeCompare(second.entryDate))[0];
    return (
      <div className={styles.enrollmentEmpty}>
        <GraduationCap aria-hidden="true" />
        <h3>{enrollmentEmptyTitle(Boolean(next), rows.length)}</h3>
        <p>
          {next
            ? `${next.class.name} · Início em ${formatDateOnlyBR(next.entryDate)}`
            : enrollmentEmptyDetail(rows.length)}
        </p>
      </div>
    );
  }
  return (
    <>
      {current.map((row) => (
        <CurrentSummary key={row.id} row={row} today={today} studentId={studentId} />
      ))}
    </>
  );
}

function enrollmentEmptyTitle(hasNext: boolean, count: number): string {
  if (hasNext) return "A próxima etapa já tem data";
  return count === 0 ? "A primeira turma vem a seguir" : "Sem matrícula em andamento";
}

function enrollmentEmptyDetail(count: number): string {
  return count === 0
    ? "Defina a turma em Pendências para preparar a entrada do aluno."
    : "Consulte o histórico e a continuidade no Pedagógico.";
}

function CurrentSummary({
  row,
  today,
  studentId,
}: {
  row: StudentEnrollment;
  today: string;
  studentId: string;
}): ReactElement {
  const stage = row.progress.find(
    (item) => item.startDate <= today && (!item.endDate || item.endDate >= today),
  );
  const back = encodeURIComponent(`/alunos/${studentId}`);
  return (
    <article className={styles.enrollmentSummary}>
      <div className={styles.stageHeading}>
        <h3>
          <Link
            href={`/turmas/${row.class.id}?voltar=${back}`}
            title={`Abrir turma: ${row.class.name}`}
          >
            {stage?.stage ?? row.class.name}
            <ArrowUpRight aria-hidden="true" />
          </Link>
        </h3>
        <Badge variant="neutral">
          {row.class.scheduleType === "PERSONALIZED" ? "PPT" : "Regular"}
        </Badge>
      </div>
      <EnrollmentFacts row={row} back={back} />
      <p className={styles.enrollmentPeriod}>
        {row.class.semester} · {row.class.format === "IN_PERSON" ? "Presencial" : "Online"} · Desde{" "}
        {formatDateOnlyBR(row.entryDate)}
        {row.exitDate && ` · Saída em ${formatDateOnlyBR(row.exitDate)}`}
      </p>
    </article>
  );
}

function EnrollmentFacts({ row, back }: { row: StudentEnrollment; back: string }): ReactElement {
  return (
    <dl className={styles.enrollmentFacts}>
      <div>
        <dt>
          <GraduationCap aria-hidden="true" /> Professor
        </dt>
        <dd>
          {row.class.teacher ? (
            <Link href={`/professores/${row.class.teacher.id}?voltar=${back}`}>
              {row.class.teacher.name}
            </Link>
          ) : (
            "A definir"
          )}
        </dd>
      </div>
      <div>
        <dt>
          <CalendarDays aria-hidden="true" /> Aulas
        </dt>
        <dd>
          {row.class.schedule.length > 0 ? (
            <ul>
              {row.class.schedule
                .toSorted(
                  (first, second) =>
                    WEEKDAYS.indexOf(first.weekday) - WEEKDAYS.indexOf(second.weekday) ||
                    first.startTime.localeCompare(second.startTime),
                )
                .map((slot) => (
                  <li key={slot.id}>
                    {DAYS[slot.weekday]}{" "}
                    <span>
                      {slot.startTime}–{slot.endTime}
                    </span>
                  </li>
                ))}
            </ul>
          ) : (
            "Consulte os encontros na agenda"
          )}
        </dd>
      </div>
    </dl>
  );
}

function EnrollmentSummaryLoading(): ReactElement {
  return (
    <div
      className={`${styles.enrollmentSummary} ${loading.surface}`}
      aria-busy="true"
      aria-label="Carregando matrícula"
    >
      <div className={styles.stageHeading}>
        <InlineSkeleton shape="block" className="h-7 w-48 max-w-full" />
        <InlineSkeleton shape="block" className="h-5 w-16" />
      </div>
      <dl className={styles.enrollmentFacts}>
        <div>
          <dt>
            <GraduationCap aria-hidden="true" /> Professor
          </dt>
          <dd>
            <InlineSkeleton className="h-3 w-32 max-w-full" />
          </dd>
        </div>
        <div>
          <dt>
            <CalendarDays aria-hidden="true" /> Aulas
          </dt>
          <dd>
            <InlineSkeleton className="h-3 w-36 max-w-full" />
          </dd>
        </div>
      </dl>
      <p className={styles.enrollmentPeriod}>
        <InlineSkeleton className="w-72 max-w-full" />
      </p>
    </div>
  );
}

export function StudentOverviewLoading(): ReactElement {
  return (
    <div className={styles.overview} aria-busy="true" aria-label="Carregando visão geral do aluno">
      <div className={styles.summaryGrid}>
        <section className={styles.enrollment}>
          <header className={styles.sectionHeading}>
            <h2>Matrícula atual</h2>
          </header>
          <EnrollmentSummaryLoading />
        </section>
        <div className={styles.healthColumn}>
          <StudentHealthLoading />
        </div>
      </div>
      <div className={styles.workGrid}>
        <section className={styles.notes}>
          <header className={styles.sectionHeading}>
            <h2>
              <NotebookPen aria-hidden="true" /> Anotações
            </h2>
            <Button size="sm" variant="ghost" disabled>
              <Pencil aria-hidden="true" /> Editar
            </Button>
          </header>
          <InlineSkeleton className="mt-6 w-5/6" />
        </section>
        <section className={styles.notes}>
          <header className={styles.sectionHeading}>
            <h2>
              <CircleCheck aria-hidden="true" /> Pendências
            </h2>
          </header>
          <InlineSkeleton className="mt-6 w-5/6" />
        </section>
      </div>
    </div>
  );
}
