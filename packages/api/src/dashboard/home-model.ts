import { saoPauloDateOnly } from "@lazuli/domain";

export const HOME_GROUPS = [
  "coverage",
  "lessons",
  "appointments",
  "placement",
  "allocation",
  "students",
  "contracts",
  "renewals",
  "semester",
] as const;
export type HomeGroupKind = (typeof HOME_GROUPS)[number];
export type HomeAction =
  | { kind: "link"; href: string }
  | { kind: "lesson" | "appointment"; id: string };
/** Facts for triage; a waiting timestamp is not a promised deadline. */
export type HomeTiming =
  | { kind: "meeting"; date: string; startTime: string; endTime: string }
  | { kind: "record"; date: string; endTime: string }
  | { kind: "waiting"; since: string }
  | { kind: "entry"; date: string };
export type HomeItem = {
  id: string;
  title: string;
  detail: string;
  date: string | null;
  action: HomeAction;
  timing?: HomeTiming;
};
export type HomeGroup = {
  kind: HomeGroupKind;
  title: string;
  description: string;
  area: "school" | "admissions" | "finance";
  attention: boolean;
  total: number;
  items: HomeItem[];
  period?: "all" | "recent" | "history";
  historyTotal?: number;
};
export const HOME_GROUP_INFO: Record<HomeGroupKind, Omit<HomeGroup, "kind" | "total" | "items">> = {
  coverage: {
    title: "Aulas sem professor",
    description: "Definir a cobertura dos próximos 7 dias.",
    area: "school",
    attention: true,
  },
  lessons: {
    title: "Aulas por registrar",
    description: "Encontros encerrados sem registro de aula.",
    area: "school",
    attention: true,
  },
  appointments: {
    title: "Atendimentos por registrar",
    description: "Encontros encerrados aguardando o resultado.",
    area: "school",
    attention: true,
  },
  placement: {
    title: "Nivelamentos por corrigir",
    description: "Provas recebidas que aguardam a definição do estágio.",
    area: "admissions",
    attention: false,
  },
  allocation: {
    title: "Interessados aguardando turma",
    description: "Pessoas que pediram uma turma e ainda aguardam uma opção compatível.",
    area: "admissions",
    attention: false,
  },
  students: {
    title: "Alunos aguardando turma",
    description: "Alunos ativos sem matrícula atual ou futura.",
    area: "school",
    attention: false,
  },
  contracts: {
    title: "Primeiro contrato a criar",
    description: "Alunos ativos sem nenhum contrato registrado.",
    area: "finance",
    attention: false,
  },
  renewals: {
    title: "Renovações a conversar",
    description: "Contratos que terminam nos próximos 30 dias, ainda sem renovação.",
    area: "finance",
    attention: false,
  },
  semester: {
    title: "Entradas em turma por confirmar",
    description:
      "Alunos com turma proposta para o semestre, mas cuja entrada ainda não foi confirmada.",
    area: "school",
    attention: false,
  },
};
const DATE_LENGTH = 10;
const DAY_MS = 86_400_000;
export const HOME_PAGE_SIZE = 12;
export const HOME_PREVIEW_SIZE = 3;
export const COVERAGE_DAYS = 6;
export const RENEWAL_DAYS = 30;
export function dateOnly(date: Date): string {
  return date.toISOString().slice(0, DATE_LENGTH);
}
export function plusDays(today: string, days: number): string {
  return dateOnly(new Date(new Date(today).getTime() + days * DAY_MS));
}
/** Civil date/time columns represent school time, not the host timezone. */
export function endedWhere(now: Date): {
  OR: Array<{ date: { lt: Date } } | { date: Date; endTime: { lte: Date } }>;
} {
  const date = new Date(saoPauloDateOnly(now));
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(now);
  return {
    OR: [{ date: { lt: date } }, { date, endTime: { lte: new Date(`1970-01-01T${time}Z`) } }],
  };
}
export function linkItem({
  id,
  title,
  detail,
  href,
  date = null,
  timing,
}: {
  id: string;
  title: string;
  detail: string;
  href: string;
  date?: string | null;
  timing?: HomeTiming;
}): HomeItem {
  return { id, title, detail, date, action: { kind: "link", href }, ...(timing && { timing }) };
}
