import { normalizeSearch } from "@lazuli/domain";

const MILLISECONDS_PER_DAY = 86_400_000;
const TRIGRAM_LENGTH = 3;
const MINIMUM_FUZZY_QUERY_LENGTH = 4;
const MAX_COMMAND_RESULTS = 16;
const SEARCH_SCORES = {
  exact: 1000,
  prefix: 800,
  substring: 600,
  fuzzyThreshold: 0.45,
  fuzzyBase: 300,
  fuzzyScale: 100,
  keywordWeight: 0.8,
  matchedEntity: 450,
  defaultBase: 100,
  section: 500,
  sameArea: 25,
  action: 40,
  frequencyLimit: 40,
  frequencyScale: 8,
  recencyLimit: 20,
} as const;

export type CommandKind = "page" | "student" | "teacher" | "class" | "lead" | "action";
export type CommandIcon = CommandKind | "finance" | "pedagogy" | "calendar" | "contract";
export type CommandAction = {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: CommandIcon;
};
export type Command = CommandAction & {
  kind: CommandKind;
  section: string;
  keywords: readonly string[];
  actions?: readonly CommandAction[];
  /** The server already matched this entity, including typo-tolerant matches. */
  matchedEntity?: boolean;
};
export type SearchIntent = {
  section: "finance" | "pedagogy" | null;
  entityQuery: string;
  entityKind: CommandKind | null;
};

const FINANCE = new Set([
  "financeiro",
  "financeira",
  "financas",
  "pagamento",
  "pagamentos",
  "cobranca",
  "cobrancas",
  "mensalidade",
  "mensalidades",
]);
const PEDAGOGY = new Set([
  "pedagogico",
  "pedagogica",
  "pedagogia",
  "acompanhamento",
  "frequencia",
  "notas",
]);
const ENTITY: Record<string, CommandKind> = {
  aluno: "student",
  aluna: "student",
  professor: "teacher",
  professora: "teacher",
  turma: "class",
  lead: "lead",
  interessado: "lead",
};

export function searchIntent(query: string): SearchIntent {
  let section: SearchIntent["section"] = null;
  let entityKind: CommandKind | null = null;
  const remaining = query
    .trim()
    .split(/\s+/)
    .filter((word) => {
      const key = normalizeSearch(word);
      if (FINANCE.has(key)) {
        section = "finance";
        return false;
      }
      if (PEDAGOGY.has(key)) {
        section = "pedagogy";
        return false;
      }
      if (ENTITY[key]) {
        entityKind = ENTITY[key];
        return false;
      }
      return true;
    });
  const entityQuery = remaining
    .join(" ")
    .replace(/^(?:do|da|de|dos|das)\s+/i, "")
    .replace(/\s+(?:do|da|de|dos|das)$/i, "");
  return { section, entityQuery, entityKind };
}

/** Signals are supplied by a caller, never read from storage or the network here. */
export type RankingContext = {
  pathname: string;
  studentSection?: string | null;
  signals?: Readonly<Record<string, { frequency: number; lastUsedAt?: number }>>;
  now?: number;
};

function trigrams(value: string): Set<string> {
  const result = new Set<string>();
  for (let index = 0; index <= value.length - TRIGRAM_LENGTH; index++)
    result.add(value.slice(index, index + TRIGRAM_LENGTH));
  return result;
}
function textScore(text: string, query: string): number {
  const value = normalizeSearch(text);
  if (value === query) return SEARCH_SCORES.exact;
  if (value.startsWith(query)) return SEARCH_SCORES.prefix;
  if (value.includes(query)) return SEARCH_SCORES.substring;
  if (query.length < MINIMUM_FUZZY_QUERY_LENGTH) return 0;
  const left = trigrams(value);
  const right = trigrams(query);
  const common = [...right].filter((part) => left.has(part)).length;
  const similarity = (2 * common) / Math.max(1, left.size + right.size);
  return similarity >= SEARCH_SCORES.fuzzyThreshold
    ? SEARCH_SCORES.fuzzyBase + similarity * SEARCH_SCORES.fuzzyScale
    : 0;
}

type CommandSearch = { normalized: string; intent: SearchIntent; entityNeedle: string };
type RankedCommand = { command: Command; score: number };

export function rankCommands(
  commands: readonly Command[],
  options: { query: string; context: RankingContext },
): Command[] {
  const { query, context } = options;
  const normalized = normalizeSearch(query);
  const intent = searchIntent(query);
  const search = { normalized, intent, entityNeedle: normalizeSearch(intent.entityQuery) };
  return commands
    .map((command, index) => scoredCommand(command, { index, search, context }))
    .filter(({ score }) => score > 0)
    .toSorted(
      (comparedLeft, comparedRight) =>
        comparedRight.score - comparedLeft.score ||
        comparedLeft.command.id.localeCompare(comparedRight.command.id),
    )
    .map(({ command }) => command)
    .slice(0, MAX_COMMAND_RESULTS);
}

function scoredCommand(
  command: Command,
  input: { index: number; search: CommandSearch; context: RankingContext },
): RankedCommand {
  const { index, search, context } = input;
  const { normalized, intent, entityNeedle } = search;
  const entity = command.kind !== "page" && command.kind !== "action";
  const needle = entity ? entityNeedle : normalized;
  let score = baseCommandScore(command, { normalized, needle, index });
  if (intent.entityKind && entity && command.kind !== intent.entityKind) score = 0;
  if (matchesSection(command, search)) score = Math.max(score, SEARCH_SCORES.section);
  if (score <= 0) return { command, score: 0 };
  return { command, score: contextualScore(command, { score, context }) };
}

function baseCommandScore(
  command: Command,
  input: { normalized: string; needle: string; index: number },
): number {
  const { normalized, needle, index } = input;
  if (!normalized) return SEARCH_SCORES.defaultBase - index;
  return Math.max(
    needle ? textScore(command.title, needle) : 0,
    ...command.keywords.map((word) =>
      needle ? textScore(word, needle) * SEARCH_SCORES.keywordWeight : 0,
    ),
    command.matchedEntity ? SEARCH_SCORES.matchedEntity : 0,
  );
}

function matchesSection(command: Command, search: CommandSearch): boolean {
  const { intent, entityNeedle } = search;
  return Boolean(
    intent.section &&
    !entityNeedle &&
    command.section === (intent.section === "finance" ? "Financeiro" : "Pedagógico"),
  );
}

function contextualScore(
  command: Command,
  input: { score: number; context: RankingContext },
): number {
  let { score } = input;
  const { context } = input;
  const inArea =
    context.pathname !== "/" &&
    command.href.split("?")[0]?.split("/")[1] === context.pathname.split("/")[1];
  if (inArea) score += SEARCH_SCORES.sameArea;
  if (command.kind === "action") score += SEARCH_SCORES.action;
  const signal = context.signals?.[command.id];
  if (signal) {
    score += Math.min(
      SEARCH_SCORES.frequencyLimit,
      Math.log2(1 + Math.max(0, signal.frequency)) * SEARCH_SCORES.frequencyScale,
    );
    if (signal.lastUsedAt && context.now)
      score += Math.max(
        0,
        SEARCH_SCORES.recencyLimit - (context.now - signal.lastUsedAt) / MILLISECONDS_PER_DAY,
      );
  }
  return score;
}

export function preferredCommand(
  command: Command,
  options: {
    intent: SearchIntent;
    context: RankingContext;
  },
): Command {
  const { intent, context } = options;

  if (command.kind !== "student" || !command.actions) return command;
  const finance =
    intent.section === "finance" ||
    (!intent.section &&
      (context.studentSection === "financeiro" ||
        /^\/(financeiro|recebiveis|contratos)(\/|$)/.test(context.pathname)));
  const action = command.actions.find((item) => item.icon === (finance ? "finance" : "pedagogy"));
  return action
    ? {
        ...command,
        href: action.href,
        actions: [action, ...command.actions.filter((item) => item.id !== action.id)],
      }
    : command;
}
