import type { JSX as ReactJSX } from "react";
import type { RouterOutputs } from "@lazuli/api";
import type { AppointmentSnapshot } from "@lazuli/validators";
import { Badge } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";

const ISO_MONTH_LENGTH = 7;
const ISO_YEAR_LENGTH = 4;
const ISO_MONTH_START_INDEX = 5;

const ISO_DATE_LENGTH = 10;

export type Appointment = RouterOutputs["appointments"]["detail"];
export type Absence = RouterOutputs["appointments"]["student"]["absences"][number];
export const purposes = {
  MAKEUP: "Reposição de falta",
  PPT_COMPLEMENT: "Complemento PPT",
  REINFORCEMENT: "Reforço",
  ASSESSMENT: "Avaliação",
} as const;
export const statuses = {
  SCHEDULED: "Agendado",
  ATTENDED: "Realizado",
  NO_SHOW: "Não compareceu",
  CANCELLED: "Cancelado",
} as const;
export function appointmentStatus(
  status: AppointmentSnapshot["status"],
  rescheduled = false,
): string {
  return status === "CANCELLED" && rescheduled ? "Reagendado" : statuses[status];
}
export function today(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function monthBounds(month: string): { from: string; through: string } {
  const valid = /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : today().slice(0, ISO_MONTH_LENGTH);
  return {
    from: `${valid}-01`,
    through: new Date(
      Date.UTC(
        Number(valid.slice(0, ISO_YEAR_LENGTH)),
        Number(valid.slice(ISO_MONTH_START_INDEX, ISO_MONTH_LENGTH)),
        0,
      ),
    )
      .toISOString()
      .slice(0, ISO_DATE_LENGTH),
  };
}
export function shiftMonth(month: string, delta: number): string {
  const date = new Date(`${monthBounds(month).from}T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + delta);
  return date.toISOString().slice(0, ISO_MONTH_LENGTH);
}
export function AppointmentBadge({
  status,
  overdue = false,
  rescheduled = false,
}: {
  rescheduled?: boolean;
  status: AppointmentSnapshot["status"];
  overdue?: boolean;
}): ReactJSX.Element {
  if (status === "CANCELLED" && rescheduled) return <Badge variant="info">Reagendado</Badge>;
  let variant: "success" | "destructive" | "warning" | "info" = "info";
  if (status === "ATTENDED") variant = "success";
  else if (status === "CANCELLED") variant = "destructive";
  else if (status === "NO_SHOW" || overdue) variant = "warning";
  return (
    <Badge variant={variant}>
      {overdue ? "A registrar" : appointmentStatus(status, rescheduled)}
    </Badge>
  );
}
export function useAppointmentRefresh() {
  const utils = trpc.useUtils();
  return async () => {
    await Promise.all([
      utils.appointments.invalidate(),
      utils.dashboard.invalidate(),
      utils.teacherWorkspace.invalidate(),
      utils.teachers.invalidate(),
      utils.students.invalidate(),
      utils.attendance.invalidate(),
      utils.classes.invalidate(),
      utils.classRecords.invalidate(),
      utils.activity.invalidate(),
    ]);
  };
}
