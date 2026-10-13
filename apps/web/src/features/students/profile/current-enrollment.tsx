import type { ReactElement } from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, ChevronDown, GraduationCap } from "lucide-react";
import { Button } from "@lazuli/ui";
import { formatDateOnlyBR } from "~/lib/format";
import type { StudentEnrollment, StudentProfile } from "./logic";
import { StudentContactSummary } from "./student-identity";
import { EnrollmentAttendance } from "./enrollment-attendance";
import { EnrollmentGradeAverage } from "./enrollment-grade-average";

type EnrollmentProps = { enrollment: StudentEnrollment; today: string };

export function CurrentEnrollment({
  enrollment,
  today,
  profile,
}: EnrollmentProps & { profile: StudentProfile }): ReactElement {
  const stage = enrollment.progress.find(
    (item) => item.startDate <= today && (!item.endDate || item.endDate >= today),
  );
  return (
    <article aria-label="Matrícula vigente" className="min-w-0 border border-border bg-accent">
      <div className="grid gap-5 px-5 py-4 lg:grid-cols-2 lg:gap-8">
        <div className="grid content-start gap-3">
          <EnrollmentHeading enrollment={enrollment} today={today} />
          <EnrollmentSchedule enrollment={enrollment} />
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-border/60 pt-2">
            <Button
              variant="link"
              size="inline"
              nativeButton={false}
              render={<Link href={planningHref(enrollment, today)} />}
            >
              Ver plano de ensino <ArrowUpRight aria-hidden="true" />
            </Button>
            {enrollment.progress.length > 1 && (
              <ProgressJourney enrollment={enrollment} today={today} />
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 border-t border-border/60 pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
          <EnrollmentAttendance
            attendance={enrollment.attendance}
            studentId={profile.id}
            studentName={profile.contact.fullName}
            enrollmentId={enrollment.id}
          />
          <EnrollmentGradeAverage progressId={stage?.id} />
        </div>
      </div>
      <div className="border-t border-border/60 bg-background/15 px-5 py-3">
        <StudentContactSummary profile={profile} />
      </div>
    </article>
  );
}

function EnrollmentHeading({ enrollment, today }: EnrollmentProps): ReactElement {
  const stage = enrollment.progress.find(
    (item) => item.startDate <= today && (!item.endDate || item.endDate >= today),
  );
  return (
    <div className="grid gap-1">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="font-display text-3xl font-medium tracking-tight text-heading">
          {stage?.stage ?? "Estágio não informado"}
        </h2>
        <p className="text-base text-muted-foreground">{stage?.track ?? "Trilha não informada"}</p>
      </div>
      <p className="text-caption text-muted-foreground">
        Matrícula {enrollment.class.semester} ·{" "}
        {enrollment.class.scheduleType === "REGULAR" ? "Regular" : "PPT"} ·{" "}
        {enrollment.class.format === "IN_PERSON" ? "Presencial" : "Online"} · Desde{" "}
        {formatDateOnlyBR(enrollment.entryDate)}
        {enrollment.exitDate && ` · Saída em ${formatDateOnlyBR(enrollment.exitDate)}`}
      </p>
    </div>
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
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
        <Link
          className="inline-flex min-h-11 items-center gap-2 text-base font-semibold text-interactive hover:underline sm:min-h-0 sm:text-sm"
          href={`/turmas/${enrollment.class.id}`}
        >
          {enrollment.class.name} <ArrowUpRight aria-hidden="true" className="size-3.5" />
        </Link>
        {enrollment.class.teacher && (
          <Link
            className="inline-flex min-h-11 items-center gap-2 text-base text-muted-foreground hover:text-foreground sm:min-h-0 sm:text-sm"
            href={`/professores/${enrollment.class.teacher.id}`}
          >
            <GraduationCap aria-hidden="true" className="size-4 shrink-0 text-icon" />
            {enrollment.class.teacher.name}
          </Link>
        )}
      </div>
      <div className="flex items-start gap-2 text-base sm:text-sm">
        <CalendarDays aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-icon" />
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {enrollment.class.schedule
            .toSorted(
              (left, right) =>
                WEEKDAYS.indexOf(left.weekday) - WEEKDAYS.indexOf(right.weekday) ||
                left.startTime.localeCompare(right.startTime),
            )
            .map((slot) => (
              <li key={slot.id} className="inline-flex items-baseline gap-2">
                <span>{DAYS[slot.weekday]}</span>
                <span className="font-numeric tabular-nums text-muted-foreground">
                  {slot.startTime}–{slot.endTime}
                </span>
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}

function ProgressJourney({ enrollment, today }: EnrollmentProps): ReactElement {
  return (
    <details className="group open:basis-full">
      <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center gap-2 text-caption text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring sm:min-h-0">
        <ChevronDown
          aria-hidden="true"
          className="size-3.5 transition-transform group-open:rotate-180 motion-reduce:transition-none"
        />
        <span className="font-medium text-foreground">Percurso</span>
        <span>
          · {enrollment.progress.length}{" "}
          {enrollment.progress.length === 1 ? "estágio registrado" : "estágios registrados"}
        </span>
      </summary>
      <ol className="mt-3 grid gap-3 sm:grid-cols-2">
        {enrollment.progress.toReversed().map((item) => (
          <li key={item.id} className="grid gap-1 border-l border-border-strong pl-3">
            <span className="text-sm font-medium">{item.stage}</span>
            <span className="text-caption text-muted-foreground">
              {formatDateOnlyBR(item.startDate)}
              {progressEndLabel(item, today)}
            </span>
            {enrollment.class.scheduleType === "PERSONALIZED" && (
              <Link
                className="inline-flex min-h-11 items-center text-caption text-interactive hover:underline sm:min-h-0"
                href={`/planejamento?turma=${enrollment.class.id}&percurso=${item.id}`}
                aria-label={`Ver plano de ensino de ${item.stage}`}
              >
                Ver plano de ensino
              </Link>
            )}
          </li>
        ))}
      </ol>
      {enrollment.progress.length === 0 && (
        <p className="px-5 pb-4 text-sm text-muted-foreground">
          Nenhum estágio registrado nesta matrícula.
        </p>
      )}
    </details>
  );
}
function progressEndLabel(item: StudentEnrollment["progress"][number], today: string): string {
  if (item.endDate) return ` — ${formatDateOnlyBR(item.endDate)}`;
  return item.startDate > today ? " · agendado" : " · em andamento";
}
function planningHref(enrollment: StudentEnrollment, today: string): string {
  const progress = enrollment.progress.find(
    (item) => item.startDate <= today && (!item.endDate || item.endDate >= today),
  );
  const params = new URLSearchParams({ turma: enrollment.class.id });
  if (enrollment.class.scheduleType === "PERSONALIZED" && progress)
    params.set("percurso", progress.id);
  return `/planejamento?${params.toString()}`;
}
