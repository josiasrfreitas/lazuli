import type { RouterOutputs } from "@lazuli/api";
import type { AppointmentSnapshot } from "@lazuli/validators";
import { Badge } from "@lazuli/ui";
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
export const channels = {
  PHONE: "Telefone",
  WHATSAPP: "WhatsApp",
  EMAIL: "E-mail",
  IN_PERSON: "Presencial",
} as const;
export const outcomes = {
  NO_ANSWER: "Sem resposta",
  REPLIED: "Respondeu",
  APPOINTMENT_AGREED: "Atendimento combinado",
  OTHER: "Outro retorno",
} as const;
export function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function monthBounds(month: string) {
  const valid = /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : today().slice(0, 7);
  return {
    from: `${valid}-01`,
    through: new Date(Date.UTC(Number(valid.slice(0, 4)), Number(valid.slice(5, 7)), 0))
      .toISOString()
      .slice(0, 10),
  };
}
export function shiftMonth(month: string, delta: number) {
  const date = new Date(`${monthBounds(month).from}T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + delta);
  return date.toISOString().slice(0, 7);
}
export function AppointmentBadge({
  status,
  overdue = false,
}: {
  status: AppointmentSnapshot["status"];
  overdue?: boolean;
}) {
  return (
    <Badge
      variant={
        status === "ATTENDED" ? "success" : status === "NO_SHOW" || overdue ? "warning" : "neutral"
      }
    >
      {overdue ? "A registrar" : statuses[status]}
    </Badge>
  );
}
export function useAppointmentRefresh() {
  const utils = trpc.useUtils();
  return async () => {
    await Promise.all([
      utils.appointments.invalidate(),
      utils.teachers.invalidate(),
      utils.students.invalidate(),
      utils.attendance.invalidate(),
      utils.classes.invalidate(),
      utils.classRecords.invalidate(),
      utils.activity.invalidate(),
    ]);
  };
}
