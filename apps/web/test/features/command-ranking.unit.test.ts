import assert from "node:assert/strict";
import { it } from "node:test";
import {
  preferredCommand,
  rankCommands,
  searchIntent,
  type Command,
  type RankingContext,
} from "../../src/features/command-palette/model.js";

function studentCommand(id: string, name: string): Command {
  return {
    id,
    title: name,
    description: "Aluno",
    href: `/alunos/${id}`,
    icon: "student",
    kind: "student",
    section: "Alunos",
    keywords: [],
    actions: [
      {
        id: `${id}-pedagogy`,
        title: "Pedagogia",
        description: "Acompanhamento do aluno",
        href: `/alunos/${id}?secao=pedagogia`,
        icon: "pedagogy",
      },
      {
        id: `${id}-finance`,
        title: "Financeiro",
        description: "Situação financeira do aluno",
        href: `/alunos/${id}?secao=financeiro`,
        icon: "finance",
      },
    ],
  };
}

void it("resolves an explicit student finance search with stable ordering and the matching destination", () => {
  const commands: Command[] = [
    studentCommand("student-b", "Ana Maria"),
    {
      id: "teacher-a",
      title: "Ana Professora",
      description: "Professora",
      href: "/professores/ana",
      icon: "teacher",
      kind: "teacher",
      section: "Professores",
      keywords: [],
    },
    studentCommand("student-a", "Ana Alves"),
  ];
  const query = "financeiro aluna Ana";
  const context: RankingContext = { pathname: "/alunos" };
  const intent = searchIntent(query);
  const selected = rankCommands(commands, { query, context }).map((command) =>
    preferredCommand(command, { intent, context }),
  );
  assert.deepEqual(
    selected.map(({ id, href, actions }) => ({ id, href, firstAction: actions?.[0]?.id })),
    [
      {
        id: "student-a",
        href: "/alunos/student-a?secao=financeiro",
        firstAction: "student-a-finance",
      },
      {
        id: "student-b",
        href: "/alunos/student-b?secao=financeiro",
        firstAction: "student-b-finance",
      },
    ],
  );
  assert.deepEqual(
    commands[0]!.actions?.map(({ id }) => id),
    ["student-b-pedagogy", "student-b-finance"],
  );
});

void it("uses the current financial context only when the query has no explicit section", () => {
  const command = studentCommand("student-a", "Ana Alves");
  const contexts: RankingContext[] = [
    { pathname: "/agenda" },
    { pathname: "/financeiro/caixa" },
    { pathname: "/alunos/student-a", studentSection: "financeiro" },
  ];
  const implicit = searchIntent("Ana");
  assert.deepEqual(
    contexts.map((context) => preferredCommand(command, { intent: implicit, context }).href),
    [
      "/alunos/student-a?secao=pedagogia",
      "/alunos/student-a?secao=financeiro",
      "/alunos/student-a?secao=financeiro",
    ],
  );
  assert.equal(
    preferredCommand(command, {
      intent: searchIntent("pedagógico aluno Ana"),
      context: { pathname: "/financeiro" },
    }).href,
    "/alunos/student-a?secao=pedagogia",
  );
});
