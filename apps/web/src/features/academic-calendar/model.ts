import type { RouterOutputs } from "@lazuli/api";
export type AcademicYear = RouterOutputs["calendar"]["academic"]["year"];
export type DayInfo = { kind: string; label: string; detail: string; markers?: string[] };
const civil = (date: Date) => date.toISOString().slice(0, 10);
export function calendarDay(date: string, data: AcademicYear): DayInfo {
  const dayStart = new Date(`${date}T00:00:00-03:00`);
  const dayEnd = new Date(dayStart.getTime() + 86400000);
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
    ...(closed.length ? ["holiday"] : []),
    ...(events.length ? ["event"] : []),
    ...(boundaries.length ? ["boundary"] : []),
  ];
  const labels = [
    ...closed.map((item) => item.reason),
    ...events.map((item) => item.title),
    ...boundaries.map(
      (item) => `${civil(item.startDate) === date ? "Início" : "Fim"} · ${item.name}`,
    ),
  ];
  return {
    kind: closed.length
      ? "holiday"
      : boundaries.length
        ? "boundary"
        : period
          ? "academic"
          : vacation
            ? "vacation"
            : "unknown",
    label:
      labels.join(" · ") ||
      (period ? "Período acadêmico" : vacation ? "Férias acadêmicas" : "Período não configurado"),
    detail: closed.length
      ? "Dia inteiro · sem atividades acadêmicas"
      : events.length
        ? `${events.length} evento(s) neste dia`
        : period
          ? period.name
          : vacation
            ? "Sem aulas regulares · atendimento extra exige confirmação"
            : "Configure os limites do semestre para este período.",
    markers,
  };
}
