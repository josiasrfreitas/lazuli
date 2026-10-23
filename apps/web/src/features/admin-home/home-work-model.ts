import type { HomeGroup } from "./home-parts";

// These are independent work queues, not consecutive or mutually exclusive student stages.
export const PEDAGOGICAL_PRIORITY: HomeGroup["kind"][] = [
  "coverage", "lessons", "appointments", "placement", "students", "allocation", "semester",
];
export const WORKSTREAMS = [
  { title: "Conduzir as aulas", kinds: ["coverage", "lessons", "appointments"] },
  { title: "Preparar a entrada em turma", kinds: ["placement", "students", "allocation"] },
  { title: "Organizar a continuidade", kinds: ["semester"] },
] as const;

export const WORK_COPY: Record<HomeGroup["kind"], { action: string; outcome: string; scope: string }> = {
  coverage: {
    action: "Definir professor",
    outcome: "Defina quem vai conduzir cada encontro para garantir as próximas aulas.",
    scope: "Próximos 7 dias",
  },
  lessons: {
    action: "Conferir registros de aula",
    outcome: "Confira os encontros sem registro e acompanhe a conclusão com os professores responsáveis.",
    scope: "Encerradas nos últimos 7 dias",
  },
  appointments: {
    action: "Registrar atendimentos",
    outcome: "Registre o resultado dos encontros para atualizar o acompanhamento individual.",
    scope: "Encerrados nos últimos 7 dias",
  },
  placement: {
    action: "Corrigir nivelamentos",
    outcome: "Defina o estágio de entrada para buscar uma turma compatível com cada aluno.",
    scope: "Provas recebidas sem estágio definido",
  },
  students: {
    action: "Definir turmas",
    outcome: "Confira o estágio e encontre uma turma para cada aluno seguir os estudos.",
    scope: "Alunos ativos sem matrícula atual ou futura",
  },
  allocation: {
    action: "Encontrar uma turma",
    outcome: "Cruze estágio e disponibilidade para dar andamento aos pedidos de alocação.",
    scope: "Leads com pedido de alocação pendente",
  },
  semester: {
    action: "Revisar alocações",
    outcome: "Revise as propostas e publique os destinos dos alunos para o próximo período de aulas.",
    scope: "Propostas ainda não publicadas",
  },
  contracts: { action: "Preparar contratos", outcome: "Alunos sem primeiro contrato.", scope: "Primeiros contratos" },
  renewals: { action: "Revisar renovações", outcome: "Conversar sobre a continuidade do contrato.", scope: "Terminam nos próximos 30 dias" },
};

export function pedagogicalGroups(groups: HomeGroup[]): HomeGroup[] {
  return PEDAGOGICAL_PRIORITY.flatMap(kind => groups.filter(group => group.kind === kind && group.total > 0));
}
