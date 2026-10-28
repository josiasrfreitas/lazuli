import type { BusinessData } from "./home-metrics";
import type { HomeData, HomeGroup, HomeItem } from "./home-parts";

export type PendingWork = {
  id: string;
  title: string;
  count: number;
  context: string;
  href: string;
  destination: string;
  score: number;
};

const DAY_MS = 86_400_000;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_MINUTE = 60;
const MILLISECONDS_PER_SECOND = 1000;
const HOUR_MS = MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;
const IMMINENT_MS = 2 * HOUR_MS;
const AGED_DAYS = 7;
const RECENT_SCORE = 4;
const URGENT_SCORE = 7;
const IMMINENT_SCORE = 10;
const PROLONGED_SCORE = 8;
const ORDINARY_OVERDUE_SCORE = 6;
const shortDate = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const number = (value: number): string => value.toLocaleString("pt-BR");
const dateLabel = (date: string): string =>
  shortDate.format(new Date(`${date}T12:00:00Z`)).replace(" de ", " ");

// Scores from the admin interview. Volume never raises a group's priority.
const GROUPS: Record<
  HomeGroup["kind"],
  Pick<PendingWork, "title" | "score" | "href" | "destination">
> = {
  coverage: { title: "Turmas sem professor", score: 7, href: "/turmas", destination: "Turmas" },
  lessons: { title: "Aulas sem registro", score: 4, href: "/aulas", destination: "Agenda" },
  appointments: {
    title: "Atendimentos sem registro",
    score: 4,
    href: "/atendimentos",
    destination: "Atendimentos",
  },
  placement: {
    title: "Nivelamentos para corrigir",
    score: 5,
    href: "/interessados",
    destination: "Interessados",
  },
  allocation: {
    title: "Interessados sem turma",
    score: 4,
    href: "/interessados",
    destination: "Interessados",
  },
  students: {
    title: "Alunos sem turma",
    score: 4,
    href: "/alunos?status=ativos",
    destination: "Alunos",
  },
  contracts: {
    title: "Alunos sem contrato",
    score: 7,
    href: "/alunos?status=ativos",
    destination: "Alunos",
  },
  renewals: {
    title: "Contratos a renovar",
    score: 5,
    href: "/contratos",
    destination: "Contratos",
  },
  semester: {
    title: "Entradas em turma para confirmar",
    score: 5,
    href: "/organizacao",
    destination: "Organização",
  },
};

function groupWork(group: HomeGroup, data: HomeData): PendingWork {
  const recordGroup = group.kind === "lessons" || group.kind === "appointments";
  const history = recentHistory(group, recordGroup);
  const item = selectItem(group, history);
  const work: PendingWork = {
    ...GROUPS[group.kind],
    id: group.kind,
    count: group.total + history,
    context: initialContext(group, item),
  };
  if (recordGroup) return recordWork(work, { kind: group.kind, item, history, today: data.today });
  if (group.kind === "coverage" && item?.timing?.kind === "meeting") {
    return coverageWork(work, { item, data });
  }
  work.context = groupContext(group.kind, item);
  if (group.kind === "semester" && item?.action.kind === "link") work.href = item.action.href;
  return work;
}

function recentHistory(group: HomeGroup, recordGroup: boolean): number {
  if (!recordGroup || group.period !== "recent") return 0;
  return group.historyTotal ?? 0;
}

function initialContext(group: HomeGroup, item: HomeItem | undefined): string {
  return item?.title ?? group.description;
}

function selectItem(group: HomeGroup, history: number): HomeItem | undefined {
  if (history > 0) return group.historyItem ?? group.items[0];
  return group.items[0];
}

function recordWork(
  work: PendingWork,
  {
    kind,
    item,
    history,
    today,
  }: {
    kind: HomeGroup["kind"];
    item: HomeItem | undefined;
    history: number;
    today: string;
  },
): PendingWork {
  const age = item?.date ? Math.round((Date.parse(today) - Date.parse(item.date)) / DAY_MS) : 0;
  work.score = history > 0 || age >= AGED_DAYS ? URGENT_SCORE : RECENT_SCORE;
  work.context = recordContext(history, item);
  if (kind === "lessons" && item?.date) work.href = `/aulas?dia=${item.date}&visao=dia`;
  return work;
}

function recordContext(history: number, item: HomeItem | undefined): string {
  if (history > 0) return `${number(history)} há 7 dias ou mais`;
  if (item?.date) return `Desde ${dateLabel(item.date)}`;
  return "Encontros encerrados";
}

function coverageWork(
  work: PendingWork,
  { item, data }: { item: HomeItem; data: HomeData },
): PendingWork {
  if (item.timing?.kind !== "meeting") return work;
  const timing = item.timing;
  const startsIn =
    Date.parse(`${timing.date}T${timing.startTime}:00-03:00`) - Date.parse(data.updatedAt);
  work.score = startsIn <= IMMINENT_MS ? IMMINENT_SCORE : URGENT_SCORE;
  const when = timing.date === data.today ? "Hoje" : dateLabel(timing.date);
  work.context = `${when}, ${timing.startTime} · ${item.title}`;
  if (item.action.kind === "link") {
    work.href = item.action.href;
    work.destination = "Ver turma";
  }
  return work;
}

function groupContext(kind: HomeGroup["kind"], item: HomeItem | undefined): string {
  const staticContext: Partial<Record<HomeGroup["kind"], string>> = {
    contracts: "Primeiro contrato ainda não criado",
    students: "Sem matrícula atual ou futura",
    allocation: "Aguardando uma turma compatível",
  };
  if (staticContext[kind]) return staticContext[kind];
  if (kind === "placement")
    return datedContext(item, {
      prefix: "Prova mais antiga",
      fallback: "Provas com estágio a definir",
    });
  if (kind === "renewals")
    return datedContext(item, {
      prefix: "Próximo vencimento",
      fallback: "Vencem nos próximos 30 dias",
    });
  if (kind === "semester")
    return datedContext(item, {
      prefix: "Primeira entrada",
      fallback: "Propostas aguardando confirmação",
    });
  return item?.title ?? "";
}

function datedContext(
  item: HomeItem | undefined,
  { prefix, fallback }: { prefix: string; fallback: string },
): string {
  return item?.date ? `${prefix}: ${dateLabel(item.date)}` : fallback;
}

export function pendingWork(data: HomeData, business?: BusinessData): PendingWork[] {
  const work = data.groups.map((group) => groupWork(group, data));
  if (data.canViewFinance && business) {
    const total = business.aging.reduce((count, bucket) => count + bucket.count, 0);
    const prolonged = business.aging.slice(1).reduce((count, bucket) => count + bucket.count, 0);
    work.push({
      id: "overdue",
      title: "Parcelas em atraso",
      count: total,
      context:
        prolonged > 0
          ? `${number(prolonged)} vencidas há mais de 30 dias`
          : "Vencidas há até 30 dias",
      score: prolonged > 0 ? PROLONGED_SCORE : ORDINARY_OVERDUE_SCORE,
      href: "/recebiveis?status=vencidas",
      destination: "Recebíveis",
    });
  }
  return work
    .filter((item) => item.count > 0 && item.score > 0)
    .toSorted((first, second) => second.score - first.score);
}
