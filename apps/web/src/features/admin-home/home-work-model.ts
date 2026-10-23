import type { HomeData, HomeGroup, HomeItem } from "./home-parts";

// Independent queues. The same student may need a class and a contract.
const PEDAGOGICAL_KINDS: HomeGroup["kind"][] = [
  "coverage", "semester", "lessons", "appointments", "placement", "students", "allocation",
];
export const WORKSTREAMS = [
  { title: "Conduzir as aulas", kinds: ["coverage", "lessons", "appointments"] },
  { title: "Preparar a entrada em turma", kinds: ["placement", "students", "allocation"] },
  { title: "Organizar a continuidade", kinds: ["semester"] },
] as const;
export const WORK_COPY: Record<HomeGroup["kind"], { action: string; outcome: string; scope: string }> = {
  coverage: { action: "Definir professor", outcome: "Defina quem vai conduzir o encontro ou organize uma substituição.", scope: "Aulas nos próximos 7 dias" },
  lessons: { action: "Conferir registros de aula", outcome: "Confira presença e conteúdo e acompanhe a conclusão com os professores responsáveis.", scope: "Aulas encerradas nos últimos 7 dias" },
  appointments: { action: "Registrar atendimentos", outcome: "Registre o resultado dos encontros para atualizar o acompanhamento individual.", scope: "Atendimentos encerrados nos últimos 7 dias" },
  placement: { action: "Corrigir nivelamentos", outcome: "A correção define o estágio para encontrar uma turma compatível.", scope: "Provas recebidas sem estágio definido" },
  students: { action: "Definir turmas", outcome: "Confira o estágio e a disponibilidade para cada aluno seguir os estudos.", scope: "Alunos ativos sem matrícula atual ou futura" },
  allocation: { action: "Encontrar uma turma", outcome: "Confira o estágio e a disponibilidade de quem aguarda uma turma.", scope: "Interessados com pedido de turma pendente" },
  semester: { action: "Confirmar entradas em turma", outcome: "Confira as turmas propostas e confirme a entrada dos alunos.", scope: "Entradas em turma ainda não confirmadas" },
  contracts: { action: "Preparar contratos", outcome: "Alunos sem primeiro contrato.", scope: "Primeiros contratos" },
  renewals: { action: "Revisar renovações", outcome: "Conversar sobre a continuidade do contrato.", scope: "Terminam nos próximos 30 dias" },
};
export type WorkPriority = {
  group: HomeGroup;
  rank: number;
  tone: "neutral" | "warning" | "destructive";
  state: "ongoing" | "today" | "date-passed" | "soon" | "waiting" | "record" | "scheduled" | "organize" | "plan";
  label: string;
  evidence: string;
  headline: string;
  action: string;
  scheduledFor?: string;
};
type Snapshot = Pick<HomeData, "today" | "updatedAt">;
const DAY_MS = 86_400_000;
const schoolDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
const schoolTime = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", timeZone: "UTC" });
export function formatWorkDate(date: string): string { return shortDate.format(new Date(`${date}T12:00:00Z`)).replace(" de ", " "); }
function daysBetween(from: string, through: string): number { return Math.round((Date.parse(through) - Date.parse(from)) / DAY_MS); }
function relativeDay(offset: number, date: string): string {
  if (offset === 0) return "hoje";
  if (offset === 1) return "amanhã";
  if (offset > 1 && offset < 7) return `em ${offset} dias`;
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

/** Local triage policy. Counts never raise severity; old work is not a fabricated SLA. */
export function workPriority(group: HomeGroup, snapshot: Snapshot): WorkPriority {
  const base: WorkPriority = {
    group, rank: 6, tone: "neutral", state: "organize", label: "Para organizar",
    evidence: WORK_COPY[group.kind].scope, headline: HEADLINES[group.kind] ?? group.title,
    action: WORK_COPY[group.kind].action,
  };
  const timing = group.items[0]?.timing;
  if (group.kind === "coverage" && timing?.kind === "meeting") {
    const days = daysBetween(snapshot.today, timing.date);
    const time = schoolTime.format(new Date(snapshot.updatedAt));
    const ongoing = days === 0 && timing.startTime <= time && time < timing.endTime;
    return {
      ...base, scheduledFor: timing.date, rank: ongoing ? 0 : days <= 0 ? 1 : days <= 2 ? 2 : 4,
      state: ongoing ? "ongoing" : days === 0 ? "today" : days <= 2 ? "soon" : "scheduled",
      tone: ongoing ? "destructive" : days <= 2 ? "warning" : "neutral",
      label: ongoing ? "Aula em andamento" : days === 0 ? "Antes da aula de hoje" : days === 1 ? "Aula amanhã" : `Aula ${relativeDay(days, timing.date)}`,
      headline: ongoing ? "A aula começou sem professor definido" : base.headline,
      evidence: `${ongoing ? "Início" : "Próxima aula"} ${relativeDay(days, timing.date)}, às ${timing.startTime}`,
    };
  }
  if (group.kind === "semester" && timing?.kind === "entry") {
    const days = daysBetween(snapshot.today, timing.date);
    return {
      ...base, scheduledFor: timing.date, rank: days <= 0 ? 1 : days <= 2 ? 2 : days < 7 ? 4 : 7,
      state: days < 0 ? "date-passed" : days === 0 ? "today" : days <= 2 ? "soon" : "plan",
      tone: days < 0 ? "destructive" : days <= 2 ? "warning" : "neutral",
      label: days < 0 ? "Data de entrada passou" : days === 0 ? "Entrada prevista hoje" : days === 1 ? "Entrada prevista amanhã" : "Preparar continuidade",
      evidence: `Primeira entrada prevista ${days < 0 ? `para ${formatWorkDate(timing.date)}` : relativeDay(days, timing.date)}`,
      headline: days < 0 ? "Revise as datas de entrada" : base.headline,
      action: days < 0 ? "Revisar datas de entrada" : base.action,
    };
  }
  if ((group.kind === "placement" || group.kind === "allocation") && timing?.kind === "waiting") {
    const days = Math.max(0, daysBetween(schoolDate.format(new Date(timing.since)), snapshot.today));
    const age = days === 0 ? "hoje" : days === 1 ? "há 1 dia" : `há ${days} dias`;
    return {
      ...base, rank: days >= 7 ? 3 : group.kind === "placement" ? 5 : 6,
      tone: days >= 7 ? "warning" : "neutral", state: "waiting",
      label: days >= 7 ? "Espera prolongada" : "Aguardando encaminhamento",
      evidence: group.kind === "placement" ? `Prova mais antiga recebida ${age}` : `Pedido mais antigo em espera ${age}`,
    };
  }
  if (group.kind === "lessons" || group.kind === "appointments") {
    const days = timing?.kind === "record" ? daysBetween(timing.date, snapshot.today) : 0;
    return {
      ...base, rank: days >= 1 ? 3 : 5, state: "record", label: "Acompanhar registros",
      evidence: timing?.kind === "record" ? `Encontro mais antigo ${days === 0 ? `hoje, até ${timing.endTime}` : `em ${formatWorkDate(timing.date)}`}` : base.evidence,
    };
  }
  // Missing timing remains visible without claiming today, overdue work, or elapsed wait.
  return { ...base, rank: group.kind === "placement" ? 5 : group.kind === "semester" ? 7 : 6 };
}
export function pedagogicalGroups(groups: HomeGroup[]): HomeGroup[] {
  return groups.filter(group => PEDAGOGICAL_KINDS.includes(group.kind) && group.total > 0);
}
export function prioritizedWork(data: Pick<HomeData, "groups" | "today" | "updatedAt">): WorkPriority[] {
  return pedagogicalGroups(data.groups).map(group => workPriority(group, data)).sort((a, b) =>
    a.rank - b.rank ||
    ([2, 4, 7].includes(a.rank) && a.scheduledFor && b.scheduledFor ? a.scheduledFor.localeCompare(b.scheduledFor) : 0) ||
    PEDAGOGICAL_KINDS.indexOf(a.group.kind) - PEDAGOGICAL_KINDS.indexOf(b.group.kind));
}
export function caseTiming(item: HomeItem, today: string): string | null {
  const timing = item.timing;
  if (!timing) return null;
  if (timing.kind === "waiting") return `Desde ${formatWorkDate(schoolDate.format(new Date(timing.since)))}`;
  const day = relativeDay(daysBetween(today, timing.date), timing.date);
  if (timing.kind === "meeting") return `${day} · ${timing.startTime}–${timing.endTime}`;
  return timing.kind === "entry" ? `Entrada ${day}` : `Encontro em ${formatWorkDate(timing.date)}`;
}
