import { addDays, isoOf, stableUuid, utcDate } from "../../packages/db/src/seed-dev-support.js";

const MONTH_DAY_OFFSET = 5;
const SPARSE_PLAN_FRACTION = 0.55;
const ITEMS_PER_UNIT = 3;
const FIRST_CONTENT_PAGE = 4;
const PAGES_PER_UNIT = 4;
const LAST_PAGE_OFFSET = 3;

const KIND_CYCLE = [
  "CONTENT",
  "CONTENT",
  "REVIEW",
  "CONTENT",
  "ACTIVITY",
  "CONTENT",
  "ASSESSMENT",
  "CONTENT",
  "REVIEW",
  "CONTENT",
] as const;
const TOPICS = [
  "Apresentações e perguntas pessoais",
  "Rotinas e preferências",
  "Pessoas e lugares",
  "Descrições e comparações",
  "Histórias e experiências",
  "Planos e possibilidades",
];
const CHILD_TOPICS = [
  "Cores e objetos da sala",
  "Família e amigos",
  "Animais e movimentos",
  "Brinquedos e brincadeiras",
  "Alimentos e preferências",
  "Casa e escola",
];

export type PlanningKind = (typeof KIND_CYCLE)[number];
export type PlanningItem = {
  id: string;
  plannedOn: string;
  kind: PlanningKind;
  title: string;
  reference: string | null;
  pageFrom: number | null;
  pageTo: number | null;
};
export type PlanningSnapshot = {
  plannedStartOn: string;
  plannedEndOn: string;
  objective: string | null;
  items: PlanningItem[];
};

/** Dates are synthetic manual intentions; they never certify a session or work performed. */
export function planningDates(input: {
  startOn: string;
  endOn: string;
  weekdays: readonly string[];
  closedDates: ReadonlySet<string>;
}): string[] {
  const weekdays = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
  const dates: string[] = [];
  for (let date = utcDate(input.startOn); isoOf(date) <= input.endOn; date = addDays(date, 1)) {
    const iso = isoOf(date);
    const fixedHoliday = [
      "01-01",
      "04-21",
      "05-01",
      "09-07",
      "10-12",
      "11-02",
      "11-15",
      "11-20",
      "12-25",
    ].includes(iso.slice(MONTH_DAY_OFFSET));
    // Future PPT semesters have no generated sessions; dates remain intentions on usual weekdays.
    const yearEndRecess =
      iso.slice(MONTH_DAY_OFFSET) >= "12-20" || iso.slice(MONTH_DAY_OFFSET) <= "01-10";
    if (
      input.weekdays.includes(weekdays[date.getUTCDay()]!) &&
      !input.closedDates.has(iso) &&
      !fixedHoliday &&
      !yearEndRecess
    )
      dates.push(iso);
  }
  return dates;
}

export function plannedItems(input: {
  planId: string;
  dates: readonly string[];
  count: number;
  detailed: boolean;
  stageCode: string;
  variation: number;
}): PlanningItem[] {
  const count = Math.min(input.count, input.dates.length);
  const span = input.detailed
    ? input.dates.length
    : Math.max(count, Math.ceil(input.dates.length * SPARSE_PLAN_FRACTION));
  return Array.from({ length: count }, (_unused, index) => {
    const position = count <= 1 ? 0 : Math.floor((index * (span - 1)) / (count - 1));
    const kind = KIND_CYCLE[(index + input.variation) % KIND_CYCLE.length]!;
    const unit = Math.floor(index / ITEMS_PER_UNIT) + 1;
    const topic = (input.stageCode.startsWith("MW") ? CHILD_TOPICS : TOPICS)[
      (unit + input.variation) % TOPICS.length
    ]!;
    const title = {
      CONTENT: topic,
      REVIEW: `Retomada guiada: ${topic.toLocaleLowerCase("pt-BR")}`,
      ASSESSMENT:
        index < count / 2
          ? "Verificação de aprendizagem — primeira etapa"
          : "Verificação de aprendizagem — segunda etapa",
      ACTIVITY: input.stageCode.startsWith("MW")
        ? "Jogo de escuta e interação em grupo"
        : "Atividade de diálogo e produção colaborativa",
    }[kind];
    const pageFrom = kind === "CONTENT" ? FIRST_CONTENT_PAGE + (unit - 1) * PAGES_PER_UNIT : null;
    return {
      id: stableUuid(["stage-plan-item", input.planId, String(index)]),
      plannedOn: input.dates[position]!,
      kind,
      title,
      reference:
        kind === "CONTENT" || kind === "REVIEW"
          ? `Livro ${input.stageCode} — Unidade ${unit}`
          : null,
      pageFrom,
      pageTo: pageFrom === null ? null : pageFrom + LAST_PAGE_OFFSET,
    };
  });
}

/** Snapshot order matches plannedOn, createdAt, id; initial items share their creation instant. */
export function orderedSnapshot(
  snapshot: PlanningSnapshot,
  createdAt: ReadonlyMap<string, Date>,
): PlanningSnapshot {
  return {
    ...snapshot,
    items: snapshot.items
      .map((item) => ({ ...item }))
      .toSorted(
        (left, right) =>
          left.plannedOn.localeCompare(right.plannedOn) ||
          createdAt.get(left.id)!.getTime() - createdAt.get(right.id)!.getTime() ||
          left.id.localeCompare(right.id),
      ),
  };
}
