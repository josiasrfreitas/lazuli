import { addDays, isoOf, stableUuid, utcDate } from "../../packages/db/src/seed-dev-support.js";

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
    ].includes(iso.slice(5));
    // Future PPT semesters have no generated sessions; dates remain intentions on usual weekdays.
    const yearEndRecess = iso.slice(5) >= "12-20" || iso.slice(5) <= "01-10";
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
    : Math.max(count, Math.ceil(input.dates.length * 0.55));
  return Array.from({ length: count }, (_, index) => {
    const position = count <= 1 ? 0 : Math.floor((index * (span - 1)) / (count - 1));
    const kind = KIND_CYCLE[(index + input.variation) % KIND_CYCLE.length]!;
    const unit = Math.floor(index / 3) + 1;
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
    const pageFrom = kind === "CONTENT" ? 4 + (unit - 1) * 4 : null;
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
      pageTo: pageFrom === null ? null : pageFrom + 3,
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
      .sort(
        (left, right) =>
          left.plannedOn.localeCompare(right.plannedOn) ||
          createdAt.get(left.id)!.getTime() - createdAt.get(right.id)!.getTime() ||
          left.id.localeCompare(right.id),
      ),
  };
}
