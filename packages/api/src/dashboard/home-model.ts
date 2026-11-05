import { saoPauloDateOnly } from "@lazuli/domain";

export const HOME_GROUPS = [
  "health",
  "occurrences",
  "coverage",
  "lessons",
  "appointments",
  "placement",
  "allocation",
  "students",
  "documents",
  "contracts",
  "renewals",
  "semester",
] as const;
export type HomeGroupKind = (typeof HOME_GROUPS)[number];
export type HomeAction =
  | { kind: "link"; href: string }
  | { kind: "lesson"; id: string }
  | { kind: "appointment"; id: string; studentId?: string };
/** Facts for triage; a waiting timestamp is not a promised deadline. */
export type HomeTiming =
  | { kind: "departure"; date: string }
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
  departedTeacherName?: string;
  stageName?: string;
  studentCount?: number;
  ageDays?: number;
  placementPhase?: "APPLICATION" | "CORRECTION";
  missingDocuments?: ("student" | "guardian" | "residence" | "photo")[];
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
  historyItem?: HomeItem;
};
export const HOME_GROUP_INFO: Record<HomeGroupKind, Omit<HomeGroup, "kind" | "total" | "items">> = {
  health: {
    title: "Score baixo",
    description: "Alunos com score abaixo de 70 ou em observação após recuperação.",
    area: "school",
    attention: true,
  },
  occurrences: {
    title: "Ocorrências pendentes",
    description: "Ocorrências abertas ou em acompanhamento.",
    area: "school",
    attention: true,
  },
  coverage: {
    title: "Turmas sem professor",
    description: "Professores com saída marcada e turmas que precisam de sucessor.",
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
    title: "Nivelamentos pendentes",
    description: "Nivelamentos que aguardam aplicação ou correção da prova.",
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
    title: "Alunos sem turma",
    description: "Alunos que entram neste período e ainda aguardam turma.",
    area: "school",
    attention: false,
  },
  documents: {
    title: "Aluno com anexos cadastrais ausentes ou incompletos",
    description: "Alunos ativos sem todos os anexos do cadastro.",
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
export const HOME_PREVIEW_SIZE = 4;
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
  departedTeacherName,
  stageName,
  studentCount,
}: {
  id: string;
  title: string;
  detail: string;
  href: string;
  date?: string | null;
  timing?: HomeTiming;
  departedTeacherName?: string;
  stageName?: string;
  studentCount?: number;
}): HomeItem {
  return {
    id,
    title,
    detail,
    date,
    action: { kind: "link", href },
    ...(timing && { timing }),
    ...(departedTeacherName && { departedTeacherName }),
    ...(stageName && { stageName }),
    ...(studentCount !== undefined && { studentCount }),
  };
}
