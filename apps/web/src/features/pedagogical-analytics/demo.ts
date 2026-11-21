import type { Period, Retention, Group, Indicators, Demand } from "./model";
export const demoToday = "2026-11-21";
export const demoPeriods: Period[] = [
  { id: "s1", period: "2026.2", previous: "2026.1", start: "2026-07-06", end: "2026-12-18" },
  { id: "s0", period: "2026.1", previous: "2025.2", start: "2026-01-12", end: "2026-06-30" },
  { id: "s-1", period: "2025.2", previous: "2025.1", start: "2025-07-07", end: "2025-12-20" },
];
const demoGroups = {
  school: ["Toda a escola"],
  teacher: ["Bia", "João"],
  age: ["12 a 17 anos", "18 anos ou mais"],
};
type DemoCohort = {
  base: number;
  exited: number;
  transferred: number;
  entrants: number;
  terminated: number;
  due: number;
  renewals: string[];
};
const cohorts: Record<string, { expiry: string; groups: DemoCohort[] }> = {
  s1: {
    expiry: "2026-08-15",
    groups: [
      {
        base: 15,
        exited: 1,
        transferred: 2,
        entrants: 4,
        terminated: 1,
        due: 7,
        renewals: ["2026-09-02", "2026-09-05", "2026-09-12", "2026-09-15"],
      },
      {
        base: 5,
        exited: 1,
        transferred: 1,
        entrants: 1,
        terminated: 0,
        due: 3,
        renewals: ["2026-09-10", "2026-11-12"],
      },
    ],
  },
  s0: {
    expiry: "2026-02-15",
    groups: [
      { base: 9, exited: 1, transferred: 1, entrants: 3, terminated: 0, due: 4, renewals: [] },
      { base: 3, exited: 0, transferred: 0, entrants: 1, terminated: 0, due: 2, renewals: [] },
    ],
  },
  "s-1": {
    expiry: "2025-10-01",
    groups: [
      { base: 8, exited: 0, transferred: 0, entrants: 2, terminated: 0, due: 0, renewals: [] },
      { base: 0, exited: 0, transferred: 0, entrants: 1, terminated: 0, due: 0, renewals: [] },
    ],
  },
};
export function demoRetention(group: Group, cutoff: string): Retention[] {
  return demoPeriods.toReversed().flatMap((period) => {
    const cohort = cohorts[period.id]!;
    return demoGroups[group].map((label, index) => {
      const members = group === "school" ? cohort.groups : [cohort.groups[index]!];
      const sum = (key: Exclude<keyof DemoCohort, "renewals">): number =>
        members.reduce((total, entry) => total + entry[key], 0);
      const pending = Number(period.id === "s-1" && index === 0);
      return {
        ...period,
        pending,
        groupId: group === "school" ? "school" : label,
        label,
        base: sum("base"),
        exited: sum("exited"),
        both: sum("base") - pending,
        originOnly: pending,
        terminated: sum("terminated"),
        transferred: sum("transferred"),
        entrants: sum("entrants"),
        entrantExits: 0,
        due: cutoff >= cohort.expiry ? sum("due") : 0,
        renewed: members.flatMap((entry) => entry.renewals).filter((day) => day <= cutoff).length,
      };
    });
  });
}
const observations: Omit<Indicators["groups"][number], "id" | "label">[] = [
  {
    base: 15,
    score: { value: 84, covered: 14 },
    attendance: { value: 82, covered: 13 },
    grades: { value: 85, covered: 9 },
    occurrences: { value: 3, covered: 13 },
    components: [
      { key: "attendance", weight: 35, value: 82 },
      { key: "grades", weight: 30, value: 85 },
      { key: "occurrences", weight: 20, value: 98 },
      { key: "interventions", weight: 15, value: 67 },
    ],
  },
  {
    base: 5,
    score: { value: 96, covered: 4 },
    attendance: { value: 94, covered: 4 },
    grades: { value: null, covered: 0 },
    occurrences: { value: 0, covered: 4 },
    components: [
      { key: "attendance", weight: 35, value: 94 },
      { key: "grades", weight: 30, value: null },
      { key: "occurrences", weight: 20, value: 100 },
      { key: "interventions", weight: 15, value: null },
    ],
  },
];
const demoWeeks = [
  { offset: 0, first: 8, second: 9 },
  { offset: 7, first: 9, second: 10 },
  { offset: 21, first: 7, second: 9 },
  { offset: 28, first: 8, second: 9 },
  { offset: 35, first: 9, second: 10 },
];
const dateLength = 10;
export function demoIndicators(group: "teacher" | "age", period: Period): Indicators {
  const groups = demoGroups[group].map((label, index) => ({
    ...observations[index]!,
    id: label,
    label,
  }));
  return {
    groups,
    weekly: groups.flatMap((row, index) =>
      demoWeeks.map((week) => {
        const day = new Date(period.start);
        day.setUTCDate(day.getUTCDate() + week.offset);
        return {
          groupId: row.id,
          week: day.toISOString().slice(0, dateLength),
          marked: 10,
          present: index === 0 ? week.first : week.second,
        };
      }),
    ),
  };
}
export function demoDemand(period: Period | undefined): Demand[] {
  const current = period?.id === "s1";
  return [
    {
      id: "foundations",
      label: "Foundations",
      waiting: 8,
      unspecified: 1,
      ...(current
        ? { ppt: 6, regularReferral: 3, direct: 2 }
        : { ppt: 3, regularReferral: 1, direct: 1 }),
    },
    {
      id: "elementary",
      label: "Elementary",
      waiting: 5,
      unspecified: 0,
      ppt: 2,
      regularReferral: 1,
      direct: 1,
    },
    {
      id: "intermediate",
      label: "Intermediate",
      waiting: 2,
      unspecified: 1,
      ppt: 0,
      regularReferral: 0,
      direct: 0,
    },
  ];
}
