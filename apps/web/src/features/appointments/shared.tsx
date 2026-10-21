import type { RouterOutputs } from "@lazuli/api";
import type { AppointmentSnapshot } from "@lazuli/validators";
import type { ReactElement } from "react";
import { Badge, type BadgeVariant } from "@lazuli/ui";
import { trpc } from "~/lib/trpc";
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
export function today(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
const MONTH_LENGTH = 7;
const YEAR_LENGTH = 4;
const MONTH_START = 5;
const DATE_LENGTH = 10;

export function monthBounds(month: string): { from: string; through: string } {
  const valid = /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : today().slice(0, MONTH_LENGTH);
  return {
    from: `${valid}-01`,
    through: new Date(
      Date.UTC(
        Number(valid.slice(0, YEAR_LENGTH)),
        Number(valid.slice(MONTH_START, MONTH_LENGTH)),
        0,
      ),
    )
      .toISOString()
      .slice(0, DATE_LENGTH),
  };
}
export function shiftMonth(month: string, delta: number): string {
  const date = new Date(`${monthBounds(month).from}T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + delta);
  return date.toISOString().slice(0, MONTH_LENGTH);
}
type BadgeState = { overdue?: boolean; rescheduled?: boolean };
export function AppointmentBadge({
  status,
  overdue = false,
  rescheduled = false,
}: {
  status: AppointmentSnapshot["status"];
} & BadgeState): ReactElement {
  return (
    <Badge variant={appointmentTone(status, { overdue, rescheduled })}>
      {appointmentStatusLabel(status, { overdue, rescheduled })}
    </Badge>
  );
}
export function appointmentStatusLabel(
  status: AppointmentSnapshot["status"],
  state: BadgeState = {},
): string {
  if (status === "CANCELLED" && state.rescheduled) return "Reagendado";
  return state.overdue ? "A registrar" : statuses[status];
}
function appointmentTone(status: AppointmentSnapshot["status"], state: BadgeState): BadgeVariant {
  if (status === "ATTENDED") return "success";
  if (status === "CANCELLED") return state.rescheduled ? "info" : "destructive";
  if (status === "NO_SHOW" || state.overdue) return "warning";
  return "info";
}
export function isRescheduled(data: Appointment): boolean {
  return data.snapshot.status === "CANCELLED" && Boolean(data.rescheduledToId);
}
export function appointmentRestriction(data: Appointment): string | null {
  return isRescheduled(data) ? "Este atendimento foi reagendado." : data.restriction;
}
export function appointmentStamp(value: string | Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
export function useAppointmentRefresh(): () => Promise<void> {
  const utils = trpc.useUtils();
  return async () => {
    await utils.invalidate();
  };
}
