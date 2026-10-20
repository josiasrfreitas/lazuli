import type { ReactElement } from "react";
import Link from "next/link";
import { CalendarDays, GraduationCap } from "lucide-react";
import { cn } from "@lazuli/ui";
import { formatAttendancePercent, formatDateOnlyBR } from "~/lib/format";
import type { StudentEnrollment } from "./logic";

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
type EnrollmentProps = { enrollment: StudentEnrollment; today: string };

export function CurrentEnrollment({ enrollment, today }: EnrollmentProps): ReactElement {
  const stage = enrollment.progress.find(
    (row) => row.startDate <= today && (!row.endDate || row.endDate >= today),
  );
  return (
    <article
      className="grid min-w-0 gap-4 border-b border-border pb-5 lg:grid-cols-3"
      aria-label="Matrícula vigente"
    >
      <div className="grid content-start gap-2 lg:col-span-2">
        <h3 className="font-display text-2xl font-medium text-heading">
          {stage?.stage ?? "Estágio não informado"}
        </h3>
        <p className="text-sm text-muted-foreground">{stage?.track ?? "Trilha não informada"}</p>
        <EnrollmentSchedule enrollment={enrollment} />
        <EnrollmentMeta enrollment={enrollment} />
        {enrollment.progress.length > 0 && <ProgressJourney enrollment={enrollment} />}
      </div>
      <div className="grid content-start gap-1 border-t border-border pt-4 lg:border-t-0 lg:pt-0">
        <h3 className="text-sm font-medium">Frequência no semestre</h3>
        <p
          className={cn(
            "font-numeric text-2xl tabular-nums",
            enrollment.attendance.flagged && "text-destructive",
          )}
        >
          {formatAttendancePercent(enrollment.attendance.percent)}
        </p>
        <p className="text-caption text-muted-foreground">
          {enrollment.attendance.heldSessions === 0
            ? "Nenhuma aula confirmada na janela da matrícula."
            : `${enrollment.attendance.presentCount} presenças em ${enrollment.attendance.heldSessions} aulas confirmadas.`}
        </p>
      </div>
    </article>
  );
}

export function EnrollmentSchedule({
  enrollment,
}: {
  enrollment: StudentEnrollment;
}): ReactElement {
  return (
    <div className="grid min-w-0 gap-2 text-sm">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <Link
          className="inline-flex min-h-11 items-center font-medium text-interactive hover:underline sm:min-h-0"
          href={`/turmas/${enrollment.class.id}`}
        >
          {enrollment.class.name}
        </Link>
        {enrollment.class.teacher ? (
          <Link
            className="inline-flex min-h-11 items-center gap-2 text-interactive hover:underline sm:min-h-0"
            href={`/professores/${enrollment.class.teacher.id}`}
          >
            <GraduationCap className="size-4" aria-hidden="true" />
            {enrollment.class.teacher.name}
          </Link>
        ) : (
          <span className="text-muted-foreground">Professor não definido</span>
        )}
      </div>
      <ScheduleSlots enrollment={enrollment} />
    </div>
  );
}

export function ProgressJourney({ enrollment }: { enrollment: StudentEnrollment }): ReactElement {
  return (
    <details className="mt-2">
      <summary className="w-fit cursor-pointer text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring">
        Percurso por estágio
      </summary>
      <ol className="mt-3 grid gap-3 sm:grid-cols-2">
        {enrollment.progress.map((row) => (
          <li key={row.id} className="grid gap-1 border-l border-border pl-3">
            <span className="text-sm font-medium">
              {row.stage} · {row.track}
            </span>
            <span className="text-caption text-muted-foreground">
              {formatDateOnlyBR(row.startDate)} ·{" "}
              {row.endDate ? `até ${formatDateOnlyBR(row.endDate)}` : "Sem término definido"}
            </span>
          </li>
        ))}
      </ol>
    </details>
  );
}

function EnrollmentMeta({ enrollment }: { enrollment: StudentEnrollment }): ReactElement {
  return (
    <p className="text-caption text-muted-foreground">
      {enrollment.class.semester} ·{" "}
      {enrollment.class.scheduleType === "REGULAR" ? "Regular" : "PPT"} ·{" "}
      {enrollment.class.format === "IN_PERSON" ? "Presencial" : "Online"} · Desde{" "}
      {formatDateOnlyBR(enrollment.entryDate)}
      {enrollment.exitDate && ` · Saída em ${formatDateOnlyBR(enrollment.exitDate)}`}
    </p>
  );
}

function ScheduleSlots({ enrollment }: { enrollment: StudentEnrollment }): ReactElement {
  const schedule = enrollment.class.schedule.toSorted(
    (left, right) =>
      WEEKDAYS.indexOf(left.weekday) - WEEKDAYS.indexOf(right.weekday) ||
      left.startTime.localeCompare(right.startTime),
  );
  return (
    <div className="flex items-start gap-2">
      <CalendarDays className="mt-0.5 size-4 shrink-0 text-icon" aria-hidden="true" />
      {schedule.length > 0 ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {schedule.map((slot) => (
            <li key={slot.id}>
              {DAYS[slot.weekday]} ·{" "}
              <span className="font-numeric tabular-nums">
                {slot.startTime}–{slot.endTime}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <span className="text-muted-foreground">Horário não definido</span>
      )}
    </div>
  );
}
