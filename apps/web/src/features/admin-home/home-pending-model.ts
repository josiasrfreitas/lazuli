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
const IMMINENT_MS = 2 * 60 * 60 * 1000;
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
  const records = group.kind === "lessons" || group.kind === "appointments";
  const history = records && group.period === "recent" ? (group.historyTotal ?? 0) : 0;
  const item = history > 0 ? (group.historyItem ?? group.items[0]) : group.items[0];
  const work: PendingWork = {
    ...GROUPS[group.kind],
    id: group.kind,
    count: group.total + history,
    context: item?.title ?? group.description,
  };

  if (records) {
    const age = item?.date
      ? Math.round((Date.parse(data.today) - Date.parse(item.date)) / DAY_MS)
      : 0;
    work.score = history > 0 || age >= 7 ? 7 : 4;
    work.context =
      history > 0
        ? `${number(history)} há 7 dias ou mais`
        : item?.date
          ? `Desde ${dateLabel(item.date)}`
          : "Encontros encerrados";
    if (group.kind === "lessons" && item?.date) work.href = `/aulas?dia=${item.date}&visao=dia`;
    return work;
  }

  if (group.kind === "coverage" && item?.timing?.kind === "meeting") {
    const timing = item.timing;
    const startsIn =
      Date.parse(`${timing.date}T${timing.startTime}:00-03:00`) - Date.parse(data.updatedAt);
    work.score = startsIn <= IMMINENT_MS ? 10 : 7;
    const when = timing.date === data.today ? "Hoje" : dateLabel(timing.date);
    work.context = `${when}, ${timing.startTime} · ${item.title}`;
    if (item.action.kind === "link") {
      work.href = item.action.href;
      work.destination = "Ver turma";
    }
    return work;
  }

  work.context = groupContext(group.kind, item);
  if (group.kind === "semester" && item?.action.kind === "link") work.href = item.action.href;
  return work;
}

function groupContext(kind: HomeGroup["kind"], item: HomeItem | undefined): string {
  if (kind === "contracts") return "Primeiro contrato ainda não criado";
  if (kind === "students") return "Sem matrícula atual ou futura";
  if (kind === "allocation") return "Aguardando uma turma compatível";
  if (kind === "placement")
    return item?.date
      ? `Prova mais antiga: ${dateLabel(item.date)}`
      : "Provas com estágio a definir";
  if (kind === "renewals")
    return item?.date
      ? `Próximo vencimento: ${dateLabel(item.date)}`
      : "Vencem nos próximos 30 dias";
  if (kind === "semester")
    return item?.date
      ? `Primeira entrada: ${dateLabel(item.date)}`
      : "Propostas aguardando confirmação";
  return item?.title ?? "";
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
      score: prolonged > 0 ? 8 : 6,
      href: "/recebiveis?status=vencidas",
      destination: "Recebíveis",
    });
  }
  return work
    .filter((item) => item.count > 0 && item.score > 0)
    .toSorted((a, b) => b.score - a.score);
}
