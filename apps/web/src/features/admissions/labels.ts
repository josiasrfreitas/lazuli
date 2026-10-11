import type { RouterOutputs } from "@lazuli/api";
export type Candidate = RouterOutputs["admissions"]["byId"];
export type CandidateRow = RouterOutputs["admissions"]["list"]["rows"][number];
export const weekdays = [
  { value: "MONDAY", label: "Segunda" },
  { value: "TUESDAY", label: "Terça" },
  { value: "WEDNESDAY", label: "Quarta" },
  { value: "THURSDAY", label: "Quinta" },
  { value: "FRIDAY", label: "Sexta" },
  { value: "SATURDAY", label: "Sábado" },
  { value: "SUNDAY", label: "Domingo" },
];
export const statusLabels = {
  WAITING: "Aguardando alocação",
  ENROLLED: "Matriculado",
  ARCHIVED: "Arquivado",
};
export const visitLabels = {
  SCHEDULED: "Agendada",
  ATTENDED: "Compareceu",
  ABSENT: "Não compareceu",
  CANCELLED: "Cancelada",
};
export const dateOnly = (value: Date): string => value.toISOString().slice(0, 10);
export const dateLabel = (value: Date | string): string =>
  (typeof value === "string" ? value : dateOnly(value)).split("-").toReversed().join("/");
export const timeLabel = (value: Date): string => value.toISOString().slice(11, 16);
export const dayLabel = (value: string): string =>
  weekdays.find((day) => day.value === value)?.label ?? value;
