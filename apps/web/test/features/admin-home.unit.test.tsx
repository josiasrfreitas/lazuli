import assert from "node:assert/strict";
import { it } from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  HomeWelcome,
  TodayAgenda,
  type HomeData,
} from "../../src/features/admin-home/home-parts.js";
import { HomeQueue } from "../../src/features/admin-home/home-queue.js";

Object.assign(globalThis, { React });

const data: HomeData = {
  today: "2026-10-23",
  updatedAt: "2026-10-23T15:00:00Z",
  name: "Maria Silva",
  activeStudents: 120,
  canViewFinance: false,
  agenda: { total: 0, items: [] },
  groups: [
    {
      kind: "lessons",
      title: "Aulas por registrar",
      description: "Encontros encerrados.",
      area: "school",
      attention: true,
      total: 2,
      items: [],
    },
    {
      kind: "students",
      title: "Alunos sem turma",
      description: "Definir turma.",
      area: "school",
      attention: false,
      total: 7,
      items: [],
    },
  ],
};
void it("distinguishes attention from normal next steps without counting every item as urgent", () => {
  const html = renderToStaticMarkup(<HomeWelcome data={data} openGroup={() => {}} />);
  assert.match(html, /Olá, Maria/);
  assert.match(html, /2 ações pedem atenção/);
  assert.doesNotMatch(html, /9 ações pedem atenção/);
  assert.match(html, /Revisar prioridades/);
});
void it("renders the operational view without finance controls or locked placeholders", () => {
  const html = renderToStaticMarkup(
    <HomeQueue data={data} selected={null} select={() => {}} open={() => {}} />,
  );
  assert.match(html, /9 ações/);
  assert.match(html, /Alunos sem turma/);
  assert.match(html, /Precisa de atenção/);
  assert.match(html, /Próximos passos/);
  assert.doesNotMatch(html, /Contratos|Recebido|bloqueado|R\$/);
});
void it("keeps the agenda useful after the day's last appointment", () => {
  const html = renderToStaticMarkup(<TodayAgenda data={data} open={() => {}} />);
  assert.match(html, /Sem novos compromissos hoje/);
  assert.match(html, /href="\/aulas\?dia=2026-10-23&amp;visao=dia"/);
  assert.match(html, /Abrir agenda/);
});
void it("describes a clear attention queue without claiming the entire school has no pending work", () => {
  const html = renderToStaticMarkup(
    <HomeWelcome
      data={{ ...data, groups: data.groups.filter((group) => !group.attention) }}
      openGroup={() => {}}
    />,
  );
  assert.match(html, /Nenhum alerta de cobertura ou registro/);
  assert.match(html, /Ver próximos passos/);
  assert.doesNotMatch(html, /Tudo resolvido/);
});
