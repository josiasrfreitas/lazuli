import type { StaffRole } from "@lazuli/auth";
import type { RouterOutputs } from "@lazuli/api";
import { navSectionsFor } from "~/components/app-shell/nav-items";
import type { Command, CommandAction } from "./model";

const ALIASES: Record<string, string[]> = {
  "/": ["inicio", "home"],
  "/alunos": ["aluno", "estudantes", "matriculas", "cadastro de aluno"],
  "/professores": ["professor", "docentes", "equipe"],
  "/turmas": ["turma", "classes", "grupos"],
  "/aulas": ["aula", "calendario", "atendimentos", "agenda", "horarios"],
  "/proximo-semestre": ["rematricula", "organizar semestre", "alocacao"],
  "/financeiro": ["financeiro", "financas", "visao geral", "financeira"],
  "/recebiveis": [
    "receber",
    "pagamentos",
    "cobrancas",
    "mensalidades",
    "inadimplencia",
    "dividas",
    "parcelas",
  ],
  "/contratos": ["contrato", "contratos", "acordos", "matricula financeira"],
  "/interessados": ["lead", "interessados", "comercial", "captacao", "prospectos"],
  "/atividades": ["historico", "auditoria", "log"],
  "/ajustes": ["configuracoes", "usuarios", "permissoes"],
  "/avaliacoes": ["notas", "provas", "avaliar"],
};

export function pageCommands(role: StaffRole): Command[] {
  return navSectionsFor(role).flatMap((section) =>
    section.items.map((item) => ({
      id: `page:${item.href}`,
      kind: "page" as const,
      title: item.label,
      description: section.label ?? "Página inicial",
      href: item.href,
      section: section.label ?? "Sistema",
      keywords: ALIASES[item.href] ?? [],
      icon:
        item.href === "/recebiveis" || item.href === "/financeiro"
          ? ("finance" as const)
          : item.href === "/aulas"
            ? ("calendar" as const)
            : item.href === "/contratos"
              ? ("contract" as const)
              : ("page" as const),
    })),
  );
}

export function studentActions(id: string): CommandAction[] {
  const path = `/alunos/${encodeURIComponent(id)}`;
  return [
    {
      id: `student:${id}:pedagogy`,
      title: "Abrir Pedagógico",
      description: "Matrícula, frequência e acompanhamento",
      href: `${path}?secao=pedagogico`,
      icon: "pedagogy",
    },
    {
      id: `student:${id}:finance`,
      title: "Abrir Financeiro",
      description: "Saldos, parcelas e tratativas",
      href: `${path}?secao=financeiro`,
      icon: "finance",
    },
    {
      id: `student:${id}:follow-up`,
      title: "Ver acompanhamento",
      description: "Ocorrências e intervenções",
      href: `${path}?secao=pedagogico#acompanhamento`,
      icon: "pedagogy",
    },
    {
      id: `student:${id}:receivables`,
      title: "Ver recebíveis",
      description: "Todas as cobranças deste aluno",
      href: `/recebiveis?aluno=${encodeURIComponent(id)}`,
      icon: "finance",
    },
  ];
}

export function contextCommands(role: StaffRole, pathname: string): Command[] {
  if (role !== "ADMIN" && role !== "SYSTEM_ADMIN") return [];
  const student = /^\/alunos\/([\da-f-]+)$/i.exec(pathname)?.[1];
  if (!student) return [];
  return studentActions(student).map((action) => ({
    ...action,
    title: action.title.replace("Abrir ", "") + " deste aluno",
    kind: "action",
    section: "Nesta página",
    keywords: [action.title, action.description],
  }));
}

type Lookup = RouterOutputs["commandSearch"]["lookup"];
export function entityCommands(data: Lookup | undefined): Command[] {
  if (!data) return [];
  return [
    ...data.students.map(
      (row): Command => ({
        id: `student:${row.id}`,
        kind: "student",
        title: row.name,
        description:
          row.classes.length > 0
            ? row.classes.map((group) => group.name).join(" · ")
            : "Sem matrícula vigente",
        section: "Alunos",
        href: `/alunos/${row.id}?secao=pedagogico`,
        icon: "student",
        keywords: [],
        matchedEntity: true,
        actions: [
          ...studentActions(row.id),
          ...row.classes.map(
            (group): CommandAction => ({
              id: `class:${group.id}`,
              title: `Abrir turma ${group.name}`,
              description: "Turma atual do aluno",
              href: `/turmas/${group.id}`,
              icon: "class",
            }),
          ),
        ],
      }),
    ),
    ...data.teachers.map(
      (row): Command => ({
        id: `teacher:${row.id}`,
        kind: "teacher",
        title: row.name,
        description: "Agenda e turmas do professor",
        section: "Professores",
        href: `/professores/${row.id}`,
        icon: "teacher",
        keywords: [],
        matchedEntity: true,
      }),
    ),
    ...data.classes.map(
      (row): Command => ({
        id: `class:${row.id}`,
        kind: "class",
        title: row.name,
        description: `${row.code} · ${row.semester}${row.status === "ACTIVE" ? "" : " · Arquivada"}`,
        section: "Turmas",
        href: `/turmas/${row.id}`,
        icon: "class",
        keywords: [row.code],
        matchedEntity: true,
      }),
    ),
    ...data.leads.map(
      (row): Command => ({
        id: `lead:${row.id}`,
        kind: "lead",
        title: row.name,
        description: "Cadastro e próximos passos",
        section: "Interessados",
        href: `/interessados/${row.id}`,
        icon: "lead",
        keywords: [],
        matchedEntity: true,
      }),
    ),
  ];
}
