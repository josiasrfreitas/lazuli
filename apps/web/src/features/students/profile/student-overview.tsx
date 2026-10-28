"use client";

import type { ReactElement } from "react";
import type { RouterOutputs } from "@lazuli/api";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, CalendarDays, GraduationCap, Wallet } from "lucide-react";
import { Badge, Button, InlineSkeleton } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
import { formatBRLFromCents, formatDateOnlyBR } from "~/lib/format";
import { useStudentPedagogy, type StudentEnrollment, type StudentProfile } from "./logic";
import { StudentNotes } from "./student-notes";
import { StudentHealth } from "./student-health";
import { ProfileError } from "./profile-shared";
import { OrganizationIntention } from "./organization-intention";
import { ContractTerminationNotice } from "./contract-termination-notice";
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
const LOADING_ROWS = 4;

export function StudentOverview({
  profile,
  navigate,
}: {
  profile: StudentProfile;
  navigate: Navigate;
}): ReactElement {
  const pedagogy = useStudentPedagogy(profile.id);
  const finance = trpc.finance.studentSummary.useQuery({ studentId: profile.id });
  return (
    <div className={styles.overview}>
      <OverviewMain
        profile={profile}
        navigate={navigate}
        pedagogy={pedagogy}
        termination={finance.data?.latestTermination}
      />
      <OverviewSide
        studentId={profile.id}
        navigate={navigate}
        summary={finance.data}
        financeError={finance.isError}
        retry={() => void finance.refetch()}
      />
    </div>
  );
}

function OverviewMain({
  profile,
  navigate,
  pedagogy,
  termination,
}: {
  profile: StudentProfile;
  navigate: Navigate;
  pedagogy: ReturnType<typeof useStudentPedagogy>;
  termination: RouterOutputs["finance"]["studentSummary"]["latestTermination"] | undefined;
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
        <ContractTerminationNotice termination={termination} studentId={profile.id} />
      </section>
      <div className={styles.overviewNotes}>
        <StudentNotes profile={profile} />
      </div>
      <div className={styles.overviewIntention}>
        <OrganizationIntention studentId={profile.id} />
      </div>
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

function OverviewSide({
  studentId,
  navigate,
  summary,
  financeError,
  retry,
}: {
  studentId: string;
  navigate: Navigate;
  summary: RouterOutputs["finance"]["studentSummary"] | undefined;
  financeError: boolean;
  retry: () => void;
}): ReactElement {
  return (
    <div className={styles.sideColumn}>
      <div className={styles.overviewHealth}>
        <StudentHealth studentId={studentId} />
      </div>
      <section className={styles.financeSnapshot} aria-labelledby="overview-finance-title">
        <header className={styles.sectionHeading}>
          <h2 id="overview-finance-title">
            <Wallet aria-hidden="true" /> Financeiro
          </h2>
          <Button variant="link" size="sm" onClick={() => navigate("financeiro")}>
            Ver financeiro <ArrowRight aria-hidden="true" />
          </Button>
        </header>
        <FinanceState summary={summary} error={financeError} retry={retry} />
      </section>
    </div>
  );
}

function FinanceState({
  summary,
  error,
  retry,
}: {
  summary: RouterOutputs["finance"]["studentSummary"] | undefined;
  error: boolean;
  retry: () => void;
}): ReactElement {
  if (error) return <ProfileError message="Resumo indisponível." onRetry={retry} />;
  if (summary) return <FinanceSnapshot summary={summary} />;
  return (
    <div className="grid gap-3 py-3" aria-label="Carregando resumo financeiro" aria-busy="true">
      <InlineSkeleton className="h-5 w-24" />
      <InlineSkeleton className="h-4 w-56 max-w-full" />
    </div>
  );
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
        <h3>{next ? "A próxima etapa já tem data" : "Sem matrícula em andamento"}</h3>
        <p>
          {next
            ? `${next.class.name} · Início em ${formatDateOnlyBR(next.entryDate)}`
            : "Matrículas e registros anteriores estão disponíveis no Pedagógico."}
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

function FinanceSnapshot({
  summary,
}: {
  summary: RouterOutputs["finance"]["studentSummary"];
}): ReactElement {
  const overdue = summary.overdueCount > 0;
  return (
    <div className={styles.snapshotContent}>
      <Badge variant={debtVariant(summary)}>{debtLabel(summary)}</Badge>
      {overdue && (
        <p className={styles.snapshotAmount}>
          {formatBRLFromCents(summary.overdueCents)}
          <span>
            em {summary.overdueCount}{" "}
            {summary.overdueCount === 1 ? "parcela vencida" : "parcelas vencidas"}
          </span>
        </p>
      )}
      {summary.nextDueDate ? (
        <p className={styles.supporting}>
          Próximo vencimento: <strong>{formatDateOnlyBR(summary.nextDueDate)}</strong> ·{" "}
          {formatBRLFromCents(summary.nextDueCents)}
        </p>
      ) : (
        <p className={styles.supporting}>
          {overdue
            ? "Consulte as parcelas para registrar o pagamento ou negociar."
            : "Nenhum vencimento futuro registrado."}
        </p>
      )}
    </div>
  );
}

function debtVariant(
  summary: RouterOutputs["finance"]["studentSummary"],
): "destructive" | "warning" | "success" | "neutral" {
  if (summary.debtState === "SEVERE_OVERDUE") return "destructive";
  if (summary.overdueCount > 0) return "warning";
  if (summary.installmentCount > 0) return "success";
  return "neutral";
}

function debtLabel(summary: RouterOutputs["finance"]["studentSummary"]): string {
  if (summary.overdueCount > 0) return "Pagamento em atraso";
  if (summary.installmentCount > 0) return "Em dia";
  return "Sem cobranças";
}

function EnrollmentSummaryLoading(): ReactElement {
  return (
    <div
      className={`${styles.enrollmentSummary} ${loading.surface}`}
      aria-busy="true"
      aria-label="Carregando matrícula"
    >
      <InlineSkeleton className="h-8 w-40" />
      <InlineSkeleton className="h-4 w-56 max-w-full" />
      <InlineSkeleton className="h-4 w-48 max-w-full" />
      <InlineSkeleton className="h-4 w-64 max-w-full" />
    </div>
  );
}

export function StudentOverviewLoading(): ReactElement {
  return (
    <div className={styles.overview} aria-busy="true" aria-label="Carregando visão geral do aluno">
      <div className={styles.mainColumn}>
        <section className={styles.enrollment}>
          <header className={styles.sectionHeading}>
            <h2>Matrícula atual</h2>
          </header>
          <EnrollmentSummaryLoading />
        </section>
        <section className={`${styles.overviewNotes} ${styles.notes} ${loading.surface}`}>
          <header className={styles.sectionHeading}>
            <h2>Anotações</h2>
          </header>
          <InlineSkeleton className="mt-4 h-4 w-full" />
          <InlineSkeleton className="mt-3 h-4 w-2/3" />
        </section>
      </div>
      <div className={styles.sideColumn}>
        <section className={`${styles.overviewHealth} ${styles.health} ${loading.surface}`}>
          <header className={styles.sectionHeading}>
            <h2>Saúde do vínculo</h2>
          </header>
          <div className={styles.healthLoading}>
            <InlineSkeleton className="h-12 w-24" />
            {Array.from({ length: LOADING_ROWS }, (_value, row) => (
              <InlineSkeleton key={row} className="h-4 w-full" />
            ))}
          </div>
        </section>
        <section className={styles.financeSnapshot}>
          <InlineSkeleton className="h-5 w-24" />
          <InlineSkeleton className="mt-4 h-4 w-56 max-w-full" />
        </section>
      </div>
    </div>
  );
}
