import type { ReactElement } from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, GraduationCap, BookOpen } from "lucide-react";
import { Badge, Button, EmptyState } from "@lazuli/ui";
import { formatAttendancePercent, formatDateOnlyBR } from "~/lib/format";
import { useStudentPedagogy, type StudentEnrollment } from "./logic";
import { ProfileLoading, ProfileError, ProfileMetric } from "./profile-shared";
import { EnrollmentHistory } from "./student-history";

export function StudentPedagogySection({ id }: { id: string }): ReactElement {
  const query = useStudentPedagogy(id);
  if (query.isPending) return <ProfileLoading />;
  if (query.isError)
    return (
      <ProfileError
        message="Não foi possível carregar o acompanhamento pedagógico."
        onRetry={() => void query.refetch()}
      />
    );
  const current = query.data.enrollments.filter((enrollment) => enrollment.current);
  const history = query.data.enrollments.filter((enrollment) => !enrollment.current);
  return (
    <div className="grid min-w-0 gap-6 pt-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Acompanhamento pedagógico</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Turma, percurso e presença em um só lugar.
          </p>
        </div>
      </div>
      {current.length ? (
        current.map((enrollment) => (
          <CurrentEnrollment key={enrollment.id} enrollment={enrollment} today={query.data.today} />
        ))
      ) : (
        <EmptyState
          icon={<BookOpen />}
          title="Sem matrícula vigente"
          description="As matrículas anteriores e futuras aparecem no histórico abaixo."
          action={
            <Button nativeButton={false} variant="secondary" render={<Link href="/turmas" />}>
              Ver turmas
            </Button>
          }
        />
      )}
      <EnrollmentHistory rows={history} today={query.data.today} />
    </div>
  );
}
function CurrentEnrollment({
  enrollment,
  today,
}: {
  enrollment: StudentEnrollment;
  today: string;
}): ReactElement {
  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="grid gap-5 p-5 sm:p-6">
        <EnrollmentHeading enrollment={enrollment} today={today} />
        <dl className="grid grid-cols-2 gap-4 border-y border-border py-3">
          <ProfileMetric
            label="Frequência no semestre"
            value={formatAttendancePercent(enrollment.attendance.percent)}
            detail={
              enrollment.attendance.heldSessions
                ? `${enrollment.attendance.presentCount} presenças em ${enrollment.attendance.heldSessions} aulas`
                : "Sem chamadas confirmadas"
            }
          />
          <ProfileMetric
            label="Início nesta turma"
            value={formatDateOnlyBR(enrollment.entryDate)}
            detail={
              enrollment.exitDate
                ? `Saída prevista: ${formatDateOnlyBR(enrollment.exitDate)}`
                : "Matrícula em andamento"
            }
          />
        </dl>
        <EnrollmentSchedule enrollment={enrollment} />
        {enrollment.attendance.flagged && (
          <p className="text-sm text-warning">
            Frequência abaixo de 75%. Acompanhe as ausências com o aluno.
          </p>
        )}
      </div>
      <ProgressJourney enrollment={enrollment} today={today} />
    </article>
  );
}
const WEEKDAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
const DAYS: Record<string, string> = {
  MONDAY: "Seg",
  TUESDAY: "Ter",
  WEDNESDAY: "Qua",
  THURSDAY: "Qui",
  FRIDAY: "Sex",
  SATURDAY: "Sáb",
  SUNDAY: "Dom",
};
function EnrollmentSchedule({ enrollment }: { enrollment: StudentEnrollment }): ReactElement {
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-interactive hover:underline"
          href={`/turmas/${enrollment.class.id}`}
        >
          {enrollment.class.name}
          <ArrowUpRight aria-hidden="true" className="size-4" />
        </Link>
        {enrollment.class.teacher && (
          <Link
            className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            href={`/professores/${enrollment.class.teacher.id}`}
          >
            <GraduationCap aria-hidden="true" className="size-4" />
            {enrollment.class.teacher.name}
          </Link>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {enrollment.class.schedule
          .toSorted(
            (a, b) =>
              WEEKDAYS.indexOf(a.weekday) - WEEKDAYS.indexOf(b.weekday) ||
              a.startTime.localeCompare(b.startTime),
          )
          .map((slot) => (
            <div
              key={slot.id}
              className="flex items-center gap-3 rounded-lg bg-muted px-3 py-2 text-sm"
            >
              <CalendarDays aria-hidden="true" className="size-4 text-muted-foreground" />
              <span className="font-medium">{DAYS[slot.weekday]}</span>
              <span className="font-numeric tabular-nums">
                {slot.startTime}–{slot.endTime}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}
function ProgressJourney({
  enrollment,
  today,
}: {
  enrollment: StudentEnrollment;
  today: string;
}): ReactElement {
  return (
    <section className="grid gap-3 border-t border-border bg-muted/30 p-5 sm:px-6">
      <h4 className="text-micro font-semibold uppercase tracking-label text-muted-foreground">
        Percurso nesta matrícula
      </h4>
      <ol className="grid gap-3">
        {enrollment.progress.toReversed().map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-baseline justify-between gap-2 border-l-2 border-border-strong pl-3"
          >
            <span className="text-sm font-medium">{item.stage}</span>
            <span className="text-caption text-muted-foreground">
              {formatDateOnlyBR(item.startDate)}
              {item.endDate
                ? ` — ${formatDateOnlyBR(item.endDate)}`
                : item.startDate > today
                  ? " · agendado"
                  : " · em andamento"}
            </span>
          </li>
        ))}
      </ol>
      {!enrollment.progress.length && (
        <p className="text-sm text-muted-foreground">Nenhum estágio registrado nesta matrícula.</p>
      )}
    </section>
  );
}

function EnrollmentHeading({
  enrollment,
  today,
}: {
  enrollment: StudentEnrollment;
  today: string;
}): ReactElement {
  const stage = enrollment.progress.find(
    (item) => item.startDate <= today && (!item.endDate || item.endDate > today),
  );
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="grid gap-2">
        <span className="text-micro font-semibold uppercase tracking-label text-muted-foreground">
          Matrícula vigente · {enrollment.class.semester}
        </span>
        <h3 className="text-2xl font-semibold tracking-tight">
          {stage?.stage ?? "Estágio não informado"}
        </h3>
        <p className="text-sm text-muted-foreground">{stage?.track ?? "Trilha não informada"}</p>
      </div>
      <Badge variant="info">
        {enrollment.class.scheduleType === "REGULAR" ? "Regular" : "PPT"} ·{" "}
        {enrollment.class.format === "IN_PERSON" ? "Presencial" : "Online"}
      </Badge>
    </div>
  );
}
