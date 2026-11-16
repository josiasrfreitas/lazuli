import type { Planning } from "./shared";
import { planningJourney, type PlanningJourney } from "./journey-model";
type OutlookInput = {
  plan: Pick<NonNullable<Planning["plan"]>, "items"> | null;
  records: Planning["records"];
  scope: Pick<Planning["scope"], "today">;
  calendar: Planning["calendar"];
  preview?: Planning["preview"];
};
type OutlookItem =
  | NonNullable<OutlookInput["plan"]>["items"][number]
  | NonNullable<OutlookInput["preview"]>["items"][number];
type OutlookStatus = "unknown" | "partial" | "complete" | "shortfall" | "tight" | "margin";
type SemesterOutlook = {
  journey: PlanningJourney<OutlookItem, Planning["records"][number]>;
  status: OutlookStatus;
  gaps: number;
  remainingMinutes: number;
  partialMinutes: number;
  margin: number;
  availableMinutes: number;
  unknownDurations: boolean;
};
export function semesterOutlook(data: OutlookInput): SemesterOutlook {
  const journey = planningJourney(data.plan?.items ?? data.preview?.items ?? [], {
    records: data.records,
    today: data.scope.today,
  });
  const frontier = journey.steps.findLast((step) => step.evidence.length > 0)?.number ?? 0;
  const gaps = journey.steps.filter(
    (step) => step.number < frontier && step.evidence.length === 0,
  ).length;
  const unknownDurations = journey.steps.some((step) => !step.item.curriculum);
  const pending = journey.steps.filter((step) => step.state !== "completed");
  const remainingMinutes = pending.reduce(
    (sum, step) => sum + (step.item.curriculum?.durationMinutes ?? 0),
    0,
  );
  const partialMinutes = pending
    .filter((step) => step.state === "partial" || step.state === "worked")
    .reduce((sum, step) => sum + (step.item.curriculum?.durationMinutes ?? 0), 0);
  const uncertain = uncertainOutlook({
    journey,
    gaps,
    unknownDurations,
    unrecordedSessions: data.calendar.unrecordedSessions,
  });
  const margin = data.calendar.availableMinutes - remainingMinutes;
  const status = outlookStatus({ uncertain, partialMinutes, pending: pending.length, margin });
  return {
    journey,
    status,
    gaps,
    remainingMinutes,
    partialMinutes,
    margin,
    availableMinutes: data.calendar.availableMinutes,
    unknownDurations,
  };
}

export type ContentGroup = {
  id: string;
  title: string;
  unit: string;
  steps: ReturnType<typeof semesterOutlook>["journey"]["steps"];
};
/** Units and lesson relationships are source metadata, never parsed from display titles. */
export function contentGroups(
  journey: ReturnType<typeof semesterOutlook>["journey"],
): ContentGroup[] {
  const groups: ContentGroup[] = [];
  for (const step of journey.steps) {
    const curriculum = step.item.curriculum;
    const unit = curriculum ? `Unidade ${curriculum.unit.sequence}` : "Programação";
    const lessons = curriculum?.lessons ?? [];
    const isAssessment = step.item.kind === "ASSESSMENT";
    const previous = groups.at(-1);
    const title = contentTitle({ lessons, isAssessment, previous, unit });
    const id = `${curriculum?.unit.id ?? "manual"}/${title}`;
    const group = groups.find((group) => group.id === id);
    if (group) group.steps.push(step);
    else groups.push({ id, title, unit, steps: [step] });
  }
  return groups;
}

function outlookStatus({
  uncertain,
  partialMinutes,
  pending,
  margin,
}: {
  uncertain: boolean;
  partialMinutes: number;
  pending: number;
  margin: number;
}): OutlookStatus {
  if (uncertain) return "unknown";
  if (partialMinutes > 0) return "partial";
  if (pending === 0) return "complete";
  if (margin < 0) return "shortfall";
  return margin < 1 ? "tight" : "margin";
}
function contentTitle({
  lessons,
  isAssessment,
  previous,
  unit,
}: {
  lessons: NonNullable<OutlookItem["curriculum"]>["lessons"];
  isAssessment: boolean;
  previous: ContentGroup | undefined;
  unit: string;
}): string {
  if (lessons.length > 0)
    return [...new Set(lessons.map((lesson) => `Lição ${lesson.sequence}`))].join(" / ");
  if (isAssessment) return "Avaliação";
  return previous?.unit === unit && previous.title !== "Avaliação" ? previous.title : "Abertura";
}

function uncertainOutlook({
  journey,
  gaps,
  unknownDurations,
  unrecordedSessions,
}: {
  journey: SemesterOutlook["journey"];
  gaps: number;
  unknownDurations: boolean;
  unrecordedSessions: number;
}): boolean {
  return (
    gaps > 0 ||
    journey.unlinked.length > 0 ||
    unrecordedSessions > 0 ||
    unknownDurations ||
    journey.steps.length === 0
  );
}
