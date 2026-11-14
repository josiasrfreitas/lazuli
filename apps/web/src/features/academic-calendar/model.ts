import type { RouterOutputs } from "@lazuli/api";
export type AcademicYear = RouterOutputs["calendar"]["academic"]["year"];
export type DayInfo = { kind: string; label: string; detail: string; markers?: string[] };
const DATE_LENGTH = 10;
const DAY_MS = 86_400_000;
const civil = (date: Date): string => date.toISOString().slice(0, DATE_LENGTH);
export function calendarDay(date: string, data: AcademicYear): DayInfo {
  const dayStart = new Date(`${date}T00:00:00-03:00`);
  const dayEnd = new Date(dayStart.getTime() + DAY_MS);
  const closed = data.closedDays.filter((item) => civil(item.date) === date);
  const events = data.events.filter((item) => item.startsAt < dayEnd && item.endsAt > dayStart);
  const boundaries = data.periods.filter(
    (item) => civil(item.startDate) === date || civil(item.endDate) === date,
  );
  const period = data.periods.find(
    (item) => civil(item.startDate) <= date && civil(item.endDate) >= date,
  );
  const vacation =
    !period &&
    data.periods.some((item) => civil(item.endDate) < date) &&
    data.periods.some((item) => civil(item.startDate) > date);
  const markers = [
    ...(closed.length > 0 ? ["holiday"] : []),
    ...(events.length > 0 ? ["event"] : []),
    ...(boundaries.length > 0 ? ["boundary"] : []),
  ];
  const labels = [
    ...closed.map((item) => item.reason),
    ...events.map((item) => item.title),
    ...boundaries.map(
      (item) => `${civil(item.startDate) === date ? "Início" : "Fim"} · ${item.name}`,
    ),
  ];
  const facts = { closed, events, boundaries, period, vacation };
  return {
    kind: dayKind(facts),
    label: labels.join(" · ") || defaultDayLabel(facts),
    detail: dayDetail(facts),
    markers,
  };
}
type DayFacts = {
  closed: AcademicYear["closedDays"];
  events: AcademicYear["events"];
  boundaries: AcademicYear["periods"];
  period: AcademicYear["periods"][number] | undefined;
  vacation: boolean;
};
function dayKind({ closed, boundaries, period, vacation }: DayFacts): string {
  if (closed.length > 0) return "holiday";
  if (boundaries.length > 0) return "boundary";
  if (period) return "academic";
  return vacation ? "vacation" : "unknown";
}
function defaultDayLabel({ period, vacation }: DayFacts): string {
  if (period) return "Período acadêmico";
  return vacation ? "Férias acadêmicas" : "Período não configurado";
}
function dayDetail({ closed, events, period, vacation }: DayFacts): string {
  if (closed.length > 0) return "Dia inteiro · sem atividades acadêmicas";
  if (events.length > 0) return `${events.length} evento(s) neste dia`;
  if (period) return period.name;
  return vacation
    ? "Sem aulas regulares · atendimento extra exige confirmação"
    : "Configure os limites do semestre para este período.";
}
