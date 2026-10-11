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
  WAITING: "Em acompanhamento",
  ENROLLED: "Matriculado",
  ARCHIVED: "Arquivado",
};
export const visitLabels = {
  SCHEDULED: "Agendada",
  ATTENDED: "Compareceu",
  ABSENT: "Não compareceu",
  CANCELLED: "Cancelada",
};
const ISO_DATE_LENGTH = 10;
const ISO_TIME_START = 11;
const ISO_TIME_END = 16;
export const dateOnly = (value: Date | null): string =>
  value ? value.toISOString().slice(0, ISO_DATE_LENGTH) : "";
export const dateLabel = (value: Date | string | null): string =>
  value === null
    ? "Não definida"
    : (typeof value === "string" ? value : dateOnly(value)).split("-").toReversed().join("/");
export const timeLabel = (value: Date): string =>
  value.toISOString().slice(ISO_TIME_START, ISO_TIME_END);
export const dayLabel = (value: string): string =>
  weekdays.find((day) => day.value === value)?.label ?? value;

export function interestLabel(value: CandidateRow["scheduleType"]): string {
  if (!value) return "Modalidade a definir";
  return value === "REGULAR" ? "Regular" : "Personalizado";
}
export function formatLabel(value: CandidateRow["format"]): string {
  if (!value) return "Formato a definir";
  return value === "IN_PERSON" ? "Presencial" : "Online";
}
