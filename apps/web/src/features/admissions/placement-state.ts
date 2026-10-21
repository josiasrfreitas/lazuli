import type { Candidate } from "./labels";

const ISO_DATE_LENGTH = 10;

type Visit = Candidate["visits"][number];

export function placementStatus(
  visit: Pick<Visit, "status" | "assessment" | "date" | "startTime">,
):
  | { label: string; variant: "neutral" }
  | { label: string; variant: "warning" }
  | { label: string; variant: "success" } {
  if (visit.status === "CANCELLED") return { label: "Cancelado", variant: "neutral" as const };
  if (visit.status === "ABSENT") return { label: "Não compareceu", variant: "warning" as const };
  if (visit.assessment?.stageId) return { label: "Estágio definido", variant: "success" as const };
  if (visit.assessment) return { label: "Aguardando correção", variant: "warning" as const };
  if (visit.status === "SCHEDULED" && !placementHasStarted(visit))
    return { label: "Agendado", variant: "neutral" as const };
  return { label: "Aguardando prova", variant: "neutral" as const };
}

export function placementHasStarted(visit: { date: Date | string; startTime: string }): boolean {
  const date =
    typeof visit.date === "string"
      ? visit.date.slice(0, ISO_DATE_LENGTH)
      : visit.date.toISOString().slice(0, ISO_DATE_LENGTH);
  return new Date(`${date}T${visit.startTime}:00-03:00`).getTime() <= Date.now();
}
