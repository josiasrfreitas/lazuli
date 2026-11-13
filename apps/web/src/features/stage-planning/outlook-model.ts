import type { Planning } from "./shared";
import { planningJourney } from "./journey-model";
type OutlookInput = {
  plan: Pick<NonNullable<Planning["plan"]>, "items"> | null;
  records: Planning["records"];
  scope: Pick<Planning["scope"], "today">;
  calendar: Planning["calendar"];
  preview?: Planning["preview"];
};
export function semesterOutlook(data: OutlookInput) {
  const journey = planningJourney(
    data.plan?.items ?? data.preview?.items ?? [],
    data.records,
    data.scope.today,
  );
  const frontier = journey.steps.findLast((step) => step.evidence.length > 0)?.number ?? 0;
  const gaps = journey.steps.filter(
    (step) => step.number < frontier && !step.evidence.length,
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
  const uncertain =
    gaps > 0 ||
    journey.unlinked.length > 0 ||
    data.calendar.unrecordedSessions > 0 ||
    unknownDurations ||
    !journey.steps.length;
  const margin = data.calendar.availableMinutes - remainingMinutes;
  const status = uncertain
    ? "unknown"
    : partialMinutes > 0
      ? "partial"
      : pending.length === 0
        ? "complete"
        : margin < 0
          ? "shortfall"
          : margin < 1
            ? "tight"
            : "margin";
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
    const title = lessons.length
      ? lessons
          .map((l) => `Lição ${l.sequence}`)
          .filter((l, i, all) => all.indexOf(l) === i)
          .join(" / ")
      : isAssessment
        ? "Avaliação"
        : previous?.unit === unit && previous.title !== "Avaliação"
          ? previous.title
          : "Abertura";
    const id = `${curriculum?.unit.id ?? "manual"}/${title}`;
    const group = groups.find((g) => g.id === id);
    if (group) group.steps.push(step);
    else groups.push({ id, title, unit, steps: [step] });
  }
  return groups;
}
