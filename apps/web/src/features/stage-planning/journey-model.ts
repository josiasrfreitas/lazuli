import { recordedActivities } from "@lazuli/domain";
/** Evidence-based view shared by class and individual planning surfaces. */
export type JourneyItem = {
  id: string;
  plannedOn: string | null;
  title: string;
  reference: string | null;
};
export type JourneyRecord = {
  id: string;
  date: string;
  time: string;
  content: {
    planItems?:
      | { id: string; status: "PARTIAL" | "COMPLETED"; title?: string | undefined }[]
      | undefined;
    planItemId?: string | null | undefined;
    planItemStatus?: "PARTIAL" | "COMPLETED" | undefined;
  };
};
export type StepState = "completed" | "partial" | "worked" | "unconfirmed" | "scheduled";
export function planningJourney<I extends JourneyItem, R extends JourneyRecord>(
  items: readonly I[],
  { records, today }: { records: readonly R[]; today: string },
): PlanningJourney<I, R> {
  const ordered = items.toSorted((first, second) =>
    (first.plannedOn ?? "9999").localeCompare(second.plannedOn ?? "9999"),
  );
  const history = records.toSorted(
    (first, second) =>
      second.date.localeCompare(first.date) || second.time.localeCompare(first.time),
  );
  const steps = ordered.map((item, index) => {
    const evidence = history.flatMap((record) => {
      const coverage = recordedActivities(record.content).find((entry) => entry.id === item.id);
      return coverage
        ? [
            {
              ...record,
              content: { ...record.content, planItemId: item.id, planItemStatus: coverage.status },
            },
          ]
        : [];
    });
    const state = stepState({ evidence, item, today });
    return { item, number: index + 1, evidence, state };
  });
  const latestLinked = history.find((record) =>
    recordedActivities(record.content).some((entry) =>
      steps.some((step) => step.item.id === entry.id),
    ),
  );
  const current = steps.findLast(
    (step) =>
      latestLinked &&
      recordedActivities(latestLinked.content).some((entry) => entry.id === step.item.id),
  );
  const expected = steps.findLast(
    (step) => step.item.plannedOn !== null && step.item.plannedOn <= today,
  );
  const dates = [...new Set(ordered.flatMap((item) => (item.plannedOn ? [item.plannedOn] : [])))];
  const difference =
    current?.item.plannedOn && expected?.item.plannedOn
      ? dates.indexOf(current.item.plannedOn) - dates.indexOf(expected.item.plannedOn)
      : null;
  const next =
    current && current.state !== "completed"
      ? current
      : steps.find((step) => step.number > (current?.number ?? 0) && step.state !== "completed");
  const groups = dates.map((date) => ({
    date,
    steps: steps.filter((step) => step.item.plannedOn === date),
  }));
  return {
    steps,
    groups,
    current,
    expected,
    next,
    difference,
    latestLinked,
    recent: history.slice(0, RECENT_LIMIT),
    completed: steps.filter((step) => step.state === "completed").length,
    unconfirmed: steps.filter((step) => step.state === "unconfirmed").length,
    unlinked: history.filter(
      (record) =>
        !recordedActivities(record.content).some((entry) =>
          steps.some((step) => step.item.id === entry.id),
        ),
    ),
  };
}

const RECENT_LIMIT = 3;
type JourneyEvidence<R extends JourneyRecord> = R & {
  content: R["content"] & {
    planItemId: string;
    planItemStatus: "PARTIAL" | "COMPLETED" | undefined;
  };
};
type JourneyStep<I extends JourneyItem, R extends JourneyRecord> = {
  item: I;
  number: number;
  evidence: JourneyEvidence<R>[];
  state: StepState;
};
export type PlanningJourney<I extends JourneyItem, R extends JourneyRecord> = {
  steps: JourneyStep<I, R>[];
  groups: { date: string; steps: JourneyStep<I, R>[] }[];
  current: JourneyStep<I, R> | undefined;
  expected: JourneyStep<I, R> | undefined;
  next: JourneyStep<I, R> | undefined;
  difference: number | null;
  latestLinked: R | undefined;
  recent: R[];
  completed: number;
  unconfirmed: number;
  unlinked: R[];
};
function stepState({
  evidence,
  item,
  today,
}: {
  evidence: JourneyRecord[];
  item: JourneyItem;
  today: string;
}): StepState {
  if (evidence.some((record) => record.content.planItemStatus === "COMPLETED")) return "completed";
  if (evidence.some((record) => record.content.planItemStatus === "PARTIAL")) return "partial";
  if (evidence.length > 0) return "worked";
  return item.plannedOn !== null && item.plannedOn <= today ? "unconfirmed" : "scheduled";
}
