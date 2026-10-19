import { normalizeSearch } from "@lazuli/domain";

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
  for (let index = 0; index <= value.length - 3; index++) result.add(value.slice(index, index + 3));
  return result;
}
function textScore(text: string, query: string): number {
  const value = normalizeSearch(text);
  if (value === query) return 1000;
  if (value.startsWith(query)) return 800;
  if (value.includes(query)) return 600;
  if (query.length < 4) return 0;
  const left = trigrams(value);
  const right = trigrams(query);
  const common = [...right].filter((part) => left.has(part)).length;
  const similarity = (2 * common) / Math.max(1, left.size + right.size);
  return similarity >= 0.45 ? 300 + similarity * 100 : 0;
}

export function rankCommands(
  commands: readonly Command[],
  query: string,
  context: RankingContext,
): Command[] {
  const normalized = normalizeSearch(query);
  const intent = searchIntent(query);
  const entityNeedle = normalizeSearch(intent.entityQuery);
  return commands
    .map((command, index) => {
      const entity = command.kind !== "page" && command.kind !== "action";
      const needle = entity ? entityNeedle : normalized;
      let score = normalized
        ? Math.max(
            needle ? textScore(command.title, needle) : 0,
            ...command.keywords.map((word) => (needle ? textScore(word, needle) * 0.8 : 0)),
            command.matchedEntity ? 450 : 0,
          )
        : 100 - index;
      if (intent.entityKind && entity && command.kind !== intent.entityKind) score = 0;
      if (
        intent.section &&
        !entityNeedle &&
        command.section === (intent.section === "finance" ? "Financeiro" : "Pedagógico")
      )
        score = Math.max(score, 500);
      if (score <= 0) return { command, score: 0 };
      const inArea =
        context.pathname !== "/" &&
        command.href.split("?")[0]?.split("/")[1] === context.pathname.split("/")[1];
      if (inArea) score += 25;
      if (command.kind === "action") score += 40;
      const signal = context.signals?.[command.id];
      if (signal) {
        score += Math.min(40, Math.log2(1 + Math.max(0, signal.frequency)) * 8);
        if (signal.lastUsedAt && context.now)
          score += Math.max(0, 20 - (context.now - signal.lastUsedAt) / 86_400_000);
      }
      return { command, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.command.id.localeCompare(b.command.id))
    .map(({ command }) => command)
    .slice(0, 16);
}

export function preferredCommand(
  command: Command,
  intent: SearchIntent,
  context: RankingContext,
): Command {
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
