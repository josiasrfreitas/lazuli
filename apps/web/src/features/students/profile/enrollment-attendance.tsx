import type { ReactElement } from "react";
import { CircleAlert } from "lucide-react";
import { cn } from "@lazuli/ui";
import { formatAttendancePercent } from "~/lib/format";
import type { StudentEnrollment } from "./logic";
import styles from "./student-profile.module.css";
import { MetricHeading } from "./metric-heading";
import { AttendanceHistoryDialog } from "./attendance-history-dialog";

type Attendance = StudentEnrollment["attendance"];

export function EnrollmentAttendance({
  attendance,
  studentId,
  studentName,
  enrollmentId,
}: {
  attendance: Attendance;
  studentId: string;
  studentName: string;
  enrollmentId: string;
}): ReactElement {
  return (
    <section aria-label="Frequência no semestre" className="flex min-w-0 flex-col gap-2">
      <AttendanceSummary attendance={attendance} />
      {attendance.percent !== null && (
        <meter
          className={styles.attendanceMeter}
          min={0}
          max={1}
          value={attendance.percent}
          data-flagged={attendance.flagged || undefined}
          aria-label="Frequência no semestre"
          aria-valuetext={formatAttendancePercent(attendance.percent)}
        />
      )}
      {attendance.heldMinutes > 0 && <AttendanceDetail attendance={attendance} />}
      {attendance.flagged && (
        <p className="flex items-start gap-2 text-sm text-warning">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          Abaixo de 75%. Acompanhe as ausências.
        </p>
      )}
      <div className="mt-auto pt-1">
        <AttendanceHistoryDialog
          studentId={studentId}
          studentName={studentName}
          enrollmentId={enrollmentId}
        />
      </div>
    </section>
  );
}

function AttendanceSummary({ attendance }: { attendance: Attendance }): ReactElement {
  return (
    <div className="grid gap-2">
      <MetricHeading label="Frequência">
        {attendance.presentMinutes} min de presença + {attendance.compensatedMinutes} min de
        reposição, em {attendance.heldMinutes} min de aula confirmados.
      </MetricHeading>
      <p
        className={cn(
          "font-numeric text-4xl font-semibold leading-none tracking-tight tabular-nums",
          attendance.flagged ? "text-warning" : "text-heading",
        )}
      >
        {formatAttendancePercent(attendance.percent)}
      </p>
      <p className="text-caption text-muted-foreground">
        {attendance.heldSessions
          ? `${attendance.presentCount} presenças em ${attendance.heldSessions} aulas`
          : "Sem chamadas confirmadas"}
      </p>
    </div>
  );
}

function AttendanceDetail({ attendance }: { attendance: Attendance }): ReactElement {
  return (
    <div className="grid gap-2">
      <dl className="flex flex-wrap gap-x-6 gap-y-2">
        <div className="flex items-baseline gap-1.5">
          <dt className="order-2 text-caption text-muted-foreground">min ausentes</dt>
          <dd className="order-1 font-numeric text-lg font-semibold tabular-nums">
            {attendance.missingMinutes}
          </dd>
        </div>
        <div className="flex items-baseline gap-1.5">
          <dt className="order-2 text-caption text-muted-foreground">min repostos</dt>
          <dd className="order-1 font-numeric text-lg font-semibold tabular-nums">
            {attendance.compensatedMinutes}
          </dd>
        </div>
      </dl>
    </div>
  );
}
