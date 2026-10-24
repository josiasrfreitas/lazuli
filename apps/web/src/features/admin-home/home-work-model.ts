import type { HomeData, HomeGroup, HomeItem } from "./home-parts";

// Independent queues. The same student may need a class and a contract.
const PEDAGOGICAL_KINDS: HomeGroup["kind"][] = [
  "coverage",
  "semester",
  "lessons",
  "appointments",
  "placement",
  "students",
  "allocation",
];
export const WORKSTREAMS = [
  { title: "Conduzir as aulas", kinds: ["coverage", "lessons", "appointments"] },
  { title: "Preparar a entrada em turma", kinds: ["placement", "students", "allocation"] },
  { title: "Organizar a continuidade", kinds: ["semester"] },
] as const;
export const WORK_COPY: Record<
  HomeGroup["kind"],
  { action: string; outcome: string; scope: string }
> = {
  coverage: {
    action: "Definir professor",
    outcome: "Defina quem vai conduzir o encontro ou organize uma substituição.",
    scope: "Aulas nos próximos 7 dias",
  },
  lessons: {
    action: "Conferir registros de aula",
    outcome: "Confira presença e conteúdo e acompanhe a conclusão com os professores responsáveis.",
    scope: "Aulas encerradas nos últimos 7 dias",
  },
  appointments: {
    action: "Registrar atendimentos",
    outcome: "Registre o resultado dos encontros para atualizar o acompanhamento individual.",
    scope: "Atendimentos encerrados nos últimos 7 dias",
  },
  placement: {
    action: "Corrigir nivelamentos",
    outcome: "A correção define o estágio para encontrar uma turma compatível.",
    scope: "Provas recebidas sem estágio definido",
  },
  students: {
    action: "Definir turmas",
    outcome: "Confira o estágio e a disponibilidade para cada aluno seguir os estudos.",
    scope: "Alunos ativos sem matrícula atual ou futura",
  },
  allocation: {
    action: "Encontrar uma turma",
    outcome: "Confira o estágio e a disponibilidade de quem aguarda uma turma.",
    scope: "Interessados com pedido de turma pendente",
  },
  semester: {
    action: "Confirmar entradas em turma",
    outcome: "Confira as turmas propostas e confirme a entrada dos alunos.",
    scope: "Entradas em turma ainda não confirmadas",
  },
  contracts: {
    action: "Preparar contratos",
    outcome: "Alunos sem primeiro contrato.",
    scope: "Primeiros contratos",
  },
  renewals: {
    action: "Revisar renovações",
    outcome: "Conversar sobre a continuidade do contrato.",
    scope: "Terminam nos próximos 30 dias",
  },
};
export type WorkPriority = {
  group: HomeGroup;
  rank: number;
  tone: "neutral" | "warning" | "destructive";
  state:
    | "ongoing"
    | "today"
    | "date-passed"
    | "soon"
    | "waiting"
    | "record"
    | "scheduled"
    | "organize"
    | "plan";
  label: string;
  evidence: string;
  headline: string;
  action: string;
  scheduledFor?: string;
};
type Snapshot = Pick<HomeData, "today" | "updatedAt">;
const DAY_MS = 86_400_000;
const SOON_DAYS = 2;
const WEEK_DAYS = 7;
const PRIORITY = {
  ongoing: 0,
  today: 1,
  soon: 2,
  aged: 3,
  scheduled: 4,
  routine: 5,
  later: 6,
  planned: 7,
} as const;
const DATE_PRIORITY_RANKS = new Set<number>([PRIORITY.soon, PRIORITY.scheduled, PRIORITY.planned]);
const schoolDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const schoolTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const shortDate = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
export function formatWorkDate(date: string): string {
  return shortDate.format(new Date(`${date}T12:00:00Z`)).replace(" de ", " ");
}
function daysBetween(from: string, through: string): number {
  return Math.round((Date.parse(through) - Date.parse(from)) / DAY_MS);
}
function relativeDay(offset: number, date: string): string {
  if (offset === 0) return "hoje";
  if (offset === 1) return "amanhã";
  if (offset > 1 && offset < WEEK_DAYS) return `em ${offset} dias`;
  return formatWorkDate(date);
}
const HEADLINES: Partial<Record<HomeGroup["kind"], string>> = {
  coverage: "Defina quem conduz a próxima aula",
  lessons: "Acompanhe os registros de aula",
  appointments: "Conclua os atendimentos realizados",
  placement: "Defina o estágio de entrada",
  students: "Encontre a turma de cada aluno",
  allocation: "Dê andamento à espera por turma",
  semester: "Prepare a entrada dos alunos",
};

type PriorityContext = { base: WorkPriority; snapshot: Snapshot };
type PriorityStatus = Pick<WorkPriority, "rank" | "state" | "tone" | "label">;
function currentOrPastCoverageStatus(days: number, label: string): PriorityStatus {
  return {
    rank: PRIORITY.today,
    state: days === 0 ? "today" : "soon",
    tone: "warning",
    label: days === 0 ? "Antes da aula de hoje" : label,
  };
}
function coveragePriority(
  timing: Extract<NonNullable<HomeItem["timing"]>, { kind: "meeting" }>,
  { base, snapshot }: PriorityContext,
): WorkPriority {
  const days = daysBetween(snapshot.today, timing.date);
  const time = schoolTime.format(new Date(snapshot.updatedAt));
  const ongoing = days === 0 && timing.startTime <= time && time < timing.endTime;
  let status: PriorityStatus = {
    rank: PRIORITY.scheduled,
    state: "scheduled",
    tone: "neutral",
    label: `Aula ${relativeDay(days, timing.date)}`,
  };
  if (ongoing) {
    status = {
      rank: PRIORITY.ongoing,
      state: "ongoing",
      tone: "destructive",
      label: "Aula em andamento",
    };
  } else if (days <= 0) {
    status = currentOrPastCoverageStatus(days, status.label);
  } else if (days <= SOON_DAYS) {
    status = {
      rank: PRIORITY.soon,
      state: "soon",
      tone: "warning",
      label: days === 1 ? "Aula amanhã" : status.label,
    };
  }
  return {
    ...base,
    scheduledFor: timing.date,
    ...status,
    headline: ongoing ? "A aula começou sem professor definido" : base.headline,
    evidence: `${ongoing ? "Início" : "Próxima aula"} ${relativeDay(days, timing.date)}, às ${timing.startTime}`,
  };
}
function semesterPriority(
  timing: Extract<NonNullable<HomeItem["timing"]>, { kind: "entry" }>,
  { base, snapshot }: PriorityContext,
): WorkPriority {
  const days = daysBetween(snapshot.today, timing.date);
  let rank: number = PRIORITY.planned;
  let state: WorkPriority["state"] = "plan";
  let tone: WorkPriority["tone"] = "neutral";
  let label = "Preparar continuidade";
  if (days < 0) {
    rank = PRIORITY.today;
    state = "date-passed";
    tone = "destructive";
    label = "Data de entrada passou";
  } else if (days === 0) {
    rank = PRIORITY.today;
    state = "today";
    tone = "warning";
    label = "Entrada prevista hoje";
  } else if (days <= SOON_DAYS) {
    rank = PRIORITY.soon;
    state = "soon";
    tone = "warning";
    if (days === 1) label = "Entrada prevista amanhã";
  } else if (days < WEEK_DAYS) rank = PRIORITY.scheduled;
  return {
    ...base,
    scheduledFor: timing.date,
    rank,
    state,
    tone,
    label,
    evidence: `Primeira entrada prevista ${days < 0 ? `para ${formatWorkDate(timing.date)}` : relativeDay(days, timing.date)}`,
    headline: days < 0 ? "Revise as datas de entrada" : base.headline,
    action: days < 0 ? "Revisar datas de entrada" : base.action,
  };
}
function waitingPriority(
  timing: Extract<NonNullable<HomeItem["timing"]>, { kind: "waiting" }>,
  { base, snapshot }: PriorityContext,
): WorkPriority {
  const days = Math.max(0, daysBetween(schoolDate.format(new Date(timing.since)), snapshot.today));
  let age = `há ${days} dias`;
  if (days === 0) age = "hoje";
  if (days === 1) age = "há 1 dia";
  return {
    ...base,
    rank: waitingRank(days, base.group.kind),
    tone: days >= WEEK_DAYS ? "warning" : "neutral",
    state: "waiting",
    label: days >= WEEK_DAYS ? "Espera prolongada" : "Aguardando encaminhamento",
    evidence:
      base.group.kind === "placement"
        ? `Prova mais antiga recebida ${age}`
        : `Pedido mais antigo em espera ${age}`,
  };
}
function waitingRank(days: number, kind: HomeGroup["kind"]): number {
  if (days >= WEEK_DAYS) return PRIORITY.aged;
  return kind === "placement" ? PRIORITY.routine : PRIORITY.later;
}
function recordPriority(
  timing: HomeItem["timing"],
  { base, snapshot }: PriorityContext,
): WorkPriority {
  if (timing?.kind !== "record")
    return { ...base, rank: PRIORITY.routine, state: "record", label: "Acompanhar registros" };
  const days = daysBetween(timing.date, snapshot.today);
  const when = days === 0 ? `hoje, até ${timing.endTime}` : `em ${formatWorkDate(timing.date)}`;
  return {
    ...base,
    rank: days >= 1 ? PRIORITY.aged : PRIORITY.routine,
    state: "record",
    label: "Acompanhar registros",
    evidence: `Encontro mais antigo ${when}`,
  };
}
function isWaitingGroup(kind: HomeGroup["kind"]): boolean {
  return kind === "placement" || kind === "allocation";
}
function isRecordGroup(kind: HomeGroup["kind"]): boolean {
  return kind === "lessons" || kind === "appointments";
}
function timedPriority(timing: HomeItem["timing"], context: PriorityContext): WorkPriority | null {
  switch (timing?.kind) {
    case "meeting": {
      return context.base.group.kind === "coverage" ? coveragePriority(timing, context) : null;
    }
    case "entry": {
      return context.base.group.kind === "semester" ? semesterPriority(timing, context) : null;
    }
    case "waiting": {
      return isWaitingGroup(context.base.group.kind) ? waitingPriority(timing, context) : null;
    }
    case "record": {
      return isRecordGroup(context.base.group.kind) ? recordPriority(timing, context) : null;
    }
    default: {
      return null;
    }
  }
}
function ordinaryPriority(base: WorkPriority, snapshot: Snapshot): WorkPriority {
  if (isRecordGroup(base.group.kind)) return recordPriority(undefined, { base, snapshot });
  if (base.group.kind === "placement") return { ...base, rank: PRIORITY.routine };
  if (base.group.kind === "semester") return { ...base, rank: PRIORITY.planned };
  return base;
}
/** Local triage policy. Counts never raise severity; old work is not a fabricated SLA. */
export function workPriority(group: HomeGroup, snapshot: Snapshot): WorkPriority {
  const base: WorkPriority = {
    group,
    rank: PRIORITY.later,
    tone: "neutral",
    state: "organize",
    label: "Para organizar",
    evidence: WORK_COPY[group.kind].scope,
    headline: HEADLINES[group.kind] ?? group.title,
    action: WORK_COPY[group.kind].action,
  };
  const timing = group.items[0]?.timing;
  const timed = timedPriority(timing, { base, snapshot });
  if (timed) return timed;
  // Missing timing remains visible without claiming today, overdue work, or elapsed wait.
  return ordinaryPriority(base, snapshot);
}
export function pedagogicalGroups(groups: HomeGroup[]): HomeGroup[] {
  return groups.filter((group) => PEDAGOGICAL_KINDS.includes(group.kind) && group.total > 0);
}
function compareWork(first: WorkPriority, second: WorkPriority): number {
  const rank = first.rank - second.rank;
  if (rank !== 0) return rank;
  if (DATE_PRIORITY_RANKS.has(first.rank) && first.scheduledFor && second.scheduledFor) {
    const date = first.scheduledFor.localeCompare(second.scheduledFor);
    if (date !== 0) return date;
  }
  return PEDAGOGICAL_KINDS.indexOf(first.group.kind) - PEDAGOGICAL_KINDS.indexOf(second.group.kind);
}
export function prioritizedWork(
  data: Pick<HomeData, "groups" | "today" | "updatedAt">,
): WorkPriority[] {
  return pedagogicalGroups(data.groups)
    .map((group) => workPriority(group, data))
    .toSorted(compareWork);
}
export function caseTiming(item: HomeItem, today: string): string | null {
  const timing = item.timing;
  if (!timing) return null;
  if (timing.kind === "waiting")
    return `Desde ${formatWorkDate(schoolDate.format(new Date(timing.since)))}`;
  const day = relativeDay(daysBetween(today, timing.date), timing.date);
  if (timing.kind === "meeting") return `${day} · ${timing.startTime}–${timing.endTime}`;
  return timing.kind === "entry" ? `Entrada ${day}` : `Encontro em ${formatWorkDate(timing.date)}`;
}
