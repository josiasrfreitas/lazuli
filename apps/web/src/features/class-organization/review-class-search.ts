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

function words(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/-feira\b/g, "");
}

export function findReviewClasses(choices: Choice[], query: string) {
  const text = words(query);
  const range =
    /\b(\d{1,2})(?:[:h](\d{2})?)?\s*(?:[-–—]|as?|ate)\s*(\d{1,2})(?:[:h](\d{2})?)?\b/.exec(text);
  const time = (hour: string, minute?: string) => hour.padStart(2, "0") + ":" + (minute ?? "00");
  const terms = (range ? text.replace(range[0], " ") : text)
    .replace(/(\d)h(\d{2})/g, "$1:$2")
    .split(/[^a-z0-9:]+/)
    .filter((t) => t && !["feira", "e", "das", "de"].includes(t));
  const days = Object.values(weekdays).map(words);
  const dayTerms = terms.filter((t) => t.length >= 3 && days.some((day) => day.startsWith(t)));
  const otherTerms = terms.filter((t) => !dayTerms.includes(t));
  return choices
    .filter((choice) => {
      const scheduleMatches = choice.slots.filter(
        (slot) =>
          (!range ||
            (slot.startTime === time(range[1]!, range[2]) &&
              slot.endTime === time(range[3]!, range[4]))) &&
          (!dayTerms.length || dayTerms.some((t) => words(weekdays[slot.weekday]).startsWith(t))),
      );
      if ((range || dayTerms.length) && !scheduleMatches.length) return false;
      const haystack = words(
        [choice.label, choice.teacher, ...choice.stages, compactSchedule(scheduleMatches)].join(
          " ",
        ),
      );
      return otherTerms.every((t) => haystack.includes(t));
    })
    .map((choice) => ({
      id: choice.id,
      label: choice.label,
      description: [...choice.stages, choice.teacher, compactSchedule(choice.slots)]
        .filter(Boolean)
        .join(" · "),
    }));
}

export function reviewClassChoices(board: OrganizationBoard) {
  const origins = new Map<string, Choice>();
  const destinations = new Map(
    board.plans.map((plan) => [
      plan.id,
      {
        id: plan.id,
        label: reviewPlanName(plan),
        teacher: plan.teacherName ?? "",
        stages: new Set([plan.stageCode, plan.stageName].filter((s): s is string => !!s)),
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
      for (const stage of [row.sourceStageCode, row.sourceStageName])
        if (stage) origin.stages.add(stage);
      origins.set(origin.id, origin);
    }
    const dest = destinations.get(row.planId ?? "");
    if (dest) for (const stage of [row.stageCode, row.stageName]) if (stage) dest.stages.add(stage);
  }
  const sorted = (items: Choice[]) =>
    items.sort((a, b) => a.label.localeCompare(b.label, "pt-BR", { numeric: true }));
  return {
    destinations: sorted([...destinations.values()]),
    origins: [
      ...sorted([...origins.values()]),
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
