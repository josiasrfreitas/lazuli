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
  records: readonly R[],
  today: string,
) {
  const ordered = items.toSorted((a, b) =>
    (a.plannedOn ?? "9999").localeCompare(b.plannedOn ?? "9999"),
  );
  const history = records.toSorted(
    (a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time),
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
    const state: StepState = evidence.some((r) => r.content.planItemStatus === "COMPLETED")
      ? "completed"
      : evidence.some((r) => r.content.planItemStatus === "PARTIAL")
        ? "partial"
        : evidence.length
          ? "worked"
          : item.plannedOn !== null && item.plannedOn <= today
            ? "unconfirmed"
            : "scheduled";
    return { item, number: index + 1, evidence, state };
  });
  const latestLinked = history.find((r) =>
    recordedActivities(r.content).some((entry) => steps.some((s) => s.item.id === entry.id)),
  );
  const current = steps.findLast(
    (s) =>
      latestLinked &&
      recordedActivities(latestLinked.content).some((entry) => entry.id === s.item.id),
  );
  const expected = steps.findLast((s) => s.item.plannedOn !== null && s.item.plannedOn <= today);
  const dates = [...new Set(ordered.flatMap((i) => (i.plannedOn ? [i.plannedOn] : [])))];
  const difference =
    current?.item.plannedOn && expected?.item.plannedOn
      ? dates.indexOf(current.item.plannedOn) - dates.indexOf(expected.item.plannedOn)
      : null;
  const next =
    current && current.state !== "completed"
      ? current
      : steps.find((s) => s.number > (current?.number ?? 0) && s.state !== "completed");
  const groups = dates.map((date) => ({
    date,
    steps: steps.filter((s) => s.item.plannedOn === date),
  }));
  return {
    steps,
    groups,
    current,
    expected,
    next,
    difference,
    latestLinked,
    recent: history.slice(0, 3),
    completed: steps.filter((s) => s.state === "completed").length,
    unconfirmed: steps.filter((s) => s.state === "unconfirmed").length,
    unlinked: history.filter(
      (r) =>
        !recordedActivities(r.content).some((entry) => steps.some((s) => s.item.id === entry.id)),
    ),
  };
}
