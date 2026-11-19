import type { ClassPlan, OrganizationBoard } from "./model";
import { compactSchedule, weekdays } from "./shared";
import { reviewPlanName } from "./review-group-model";
import { REVIEW_NO_ORIGIN } from "./review-filters";

type Choice = {
  id: string;
  label: string;
  stages: Set<string>;
  teacher: string;
  slots: ClassPlan["slots"];
};

type ClassSearchResult = { id: string; label: string; description: string };
type ClassChoices = { destinations: Choice[]; origins: Choice[] };
const minimumDayPrefixLength = 3;
const ignoredTerms = new Set(["feira", "e", "das", "de"]);

function words(text: string): string {
  return text
    .normalize("NFD")
    .replaceAll(/\p{M}/gu, "")
    .toLowerCase()
    .replaceAll(/-feira\b/g, "");
}

function formatHour(hour: string, minute?: string): string {
  return hour.padStart(2, "0") + ":" + (minute ?? "00");
}

export function findReviewClasses(choices: Choice[], query: string): ClassSearchResult[] {
  const text = words(query);
  const range =
    /\b(\d{1,2})(?:[:h](\d{2})?)?\s*(?:[-–—]|as?|ate)\s*(\d{1,2})(?:[:h](\d{2})?)?\b/.exec(text);
  const terms = (range ? text.replace(range[0], " ") : text)
    .replaceAll(/(\d)h(\d{2})/g, "$1:$2")
    .split(/[^a-z0-9:]+/)
    .filter((term) => term && !ignoredTerms.has(term));
  const days = Object.values(weekdays).map((day) => words(day));
  const dayTerms = terms.filter(
    (term) => term.length >= minimumDayPrefixLength && days.some((day) => day.startsWith(term)),
  );
  const otherTerms = terms.filter((term) => !dayTerms.includes(term));
  const start = range ? formatHour(range[1]!, range[2]) : null;
  const end = range ? formatHour(range[3]!, range[4]) : null;
  return choices
    .filter((choice) => {
      const scheduleMatches = choice.slots.filter(
        (slot) =>
          (!range || (slot.startTime === start && slot.endTime === end)) &&
          (dayTerms.length === 0 ||
            dayTerms.some((term) => words(weekdays[slot.weekday]).startsWith(term))),
      );
      if ((range || dayTerms.length > 0) && scheduleMatches.length === 0) return false;
      const haystack = words(
        [choice.label, choice.teacher, ...choice.stages, compactSchedule(scheduleMatches)].join(
          " ",
        ),
      );
      return otherTerms.every((term) => haystack.includes(term));
    })
    .map((choice) => ({
      id: choice.id,
      label: choice.label,
      description: [...choice.stages, choice.teacher, compactSchedule(choice.slots)]
        .filter(Boolean)
        .join(" · "),
    }));
}

function addStages(choice: Choice, values: readonly (string | null)[]): void {
  for (const stage of values) {
    if (stage) choice.stages.add(stage);
  }
}

function sortedChoices(items: Choice[]): Choice[] {
  return items.toSorted((left, right) =>
    left.label.localeCompare(right.label, "pt-BR", { numeric: true }),
  );
}

export function reviewClassChoices(board: OrganizationBoard): ClassChoices {
  const origins = new Map<string, Choice>();
  const destinations = new Map<string, Choice>(
    board.plans.map((plan) => [
      plan.id,
      {
        id: plan.id,
        label: reviewPlanName(plan),
        teacher: plan.teacherName ?? "",
        stages: new Set(
          [plan.stageCode, plan.stageName].filter((stage): stage is string => Boolean(stage)),
        ),
        slots: plan.slots,
      },
    ]),
  );
  for (const row of board.placements) {
    if (row.sourceClassId) {
      const origin = origins.get(row.sourceClassId) ?? {
        id: row.sourceClassId,
        label: row.sourceClassName ?? "Turma de origem",
        teacher: row.sourceTeacher ?? "",
        slots: row.sourceSchedule,
        stages: new Set<string>(),
      };
      addStages(origin, [row.sourceStageCode, row.sourceStageName]);
      origins.set(origin.id, origin);
    }
    const destination = destinations.get(row.planId ?? "");
    if (destination) addStages(destination, [row.stageCode, row.stageName]);
  }
  return {
    destinations: sortedChoices([...destinations.values()]),
    origins: [
      ...sortedChoices([...origins.values()]),
      {
        id: REVIEW_NO_ORIGIN,
        label: "Sem turma de origem",
        teacher: "",
        stages: new Set<string>(),
        slots: [],
      },
    ],
  };
}
