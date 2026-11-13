// Illustrative workshop data only. Never persisted or used for scheduling decisions.
export const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
export const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export function isoDay(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
export function dayInfo(date: string) {
  const md = date.slice(5);
  if (md === "09-07")
    return {
      kind: "holiday",
      label: "Independência do Brasil",
      detail: "Sem atividades acadêmicas · feriado nacional",
    };
  if (["02-02", "06-30", "08-03", "12-18"].includes(md))
    return {
      kind: "boundary",
      label: ["02-02", "08-03"].includes(md) ? "Início do semestre" : "Fim do semestre",
      detail: "Limite do período acadêmico",
    };
  if (md === "09-18")
    return {
      kind: "event",
      label: "Encontro cultural",
      detail: "18:00–20:00 · evento ilustrativo",
    };
  if ((md >= "02-02" && md <= "06-30") || (md >= "08-03" && md <= "12-18"))
    return {
      kind: "academic",
      label: "Período acadêmico",
      detail: "Aulas conforme os horários de cada turma",
    };
  return {
    kind: "vacation",
    label: "Férias acadêmicas",
    detail: "Sem aulas regulares · atendimento extra exige confirmação",
  };
}
