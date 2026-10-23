import assert from "node:assert/strict";
import { it } from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HomeWelcome, TodayAgenda, type HomeData } from "../../src/features/admin-home/home-parts.js";
import { HomeQueue, HomeAttention } from "../../src/features/admin-home/home-queue.js";
import { Trend } from "../../src/features/admin-home/home-metrics.js";
import { isSchoolStarting } from "../../src/features/admin-home/home-start.js";

Object.assign(globalThis, { React });
const emptyMetric = { value: 0, previous: 0, series: [{ month: "2026-10", value: 0 }] };
const data: HomeData = {
  today: "2026-10-23", updatedAt: "2026-10-23T15:00:00Z", name: "Maria Silva",
  activeStudents: 120, canViewFinance: false, agenda: { total: 0, items: [] },
  school: { month: "2026-10", through: "2026-10-23", previousThrough: "2026-09-23", partial: true, totalStudents: 120, students: emptyMetric, enrollments: emptyMetric, trials: emptyMetric },
  groups: [
    { kind: "lessons", title: "Aulas por registrar", description: "Encontros encerrados.", area: "school", attention: true, total: 2, historyTotal: 618, items: [] },
    { kind: "students", title: "Alunos sem turma", description: "Definir turma.", area: "school", attention: false, total: 7, items: [] },
  ],
};
void it("separates urgent records from ordinary next steps and older history", () => {
  const html = renderToStaticMarkup(<HomeAttention data={data} select={() => {}} />);
  assert.match(html, /Há registros para concluir/);
  assert.match(html, /<strong>2<\/strong>/);
  assert.doesNotMatch(html, /618|Alunos sem turma|<strong>9/);
  assert.equal(renderToStaticMarkup(<HomeAttention data={{ ...data, groups: [] }} select={() => {}} />), "");
});
void it("renders operational next steps without finance or zero-queue tiles", () => {
  const html = renderToStaticMarkup(<HomeQueue data={{ ...data, groups: [...data.groups, { kind: "placement", title: "Nivelamentos", description: "Correções", area: "admissions", attention: false, total: 0, items: [] }] }} selected={null} select={() => {}} open={() => {}} />);
  assert.match(html, /Alunos sem turma/);
  assert.match(html, /Definir turmas/);
  assert.match(html, /Registros anteriores/);
  assert.match(html, /618 aulas/);
  assert.doesNotMatch(html, /Nivelamentos para corrigir|Contratos|Recebido|bloqueado|R\$/);
});
void it("keeps the agenda useful after the day's last appointment and distinguishes failure from loading", () => {
  const html = renderToStaticMarkup(<TodayAgenda data={data} open={() => {}} />);
  assert.match(html, /Sem compromissos restantes hoje/);
  assert.match(html, /href="\/aulas\?dia=2026-10-23&amp;visao=dia"/);
  const error = renderToStaticMarkup(<TodayAgenda data={undefined} loading={false} open={() => {}} />);
  assert.match(error, /Agenda indisponível/);
  assert.doesNotMatch(error, /Carregando agenda/);
});
void it("does not fabricate percentage growth when the comparison baseline is zero", () => {
  const html = renderToStaticMarkup(<Trend current={10} previous={0} partial />);
  assert.match(html, /Sem base anterior/);
  assert.doesNotMatch(html, /Infinity|NaN|100%/);
  const compared = renderToStaticMarkup(<Trend current={15} previous={10} partial />);
  assert.match(compared, /\+50%/);
  assert.match(compared, /mesmos dias do mês anterior/);
});
void it("does not replace a school with history by the first-use screen", () => {
  assert.equal(isSchoolStarting({ ...data, activeStudents: 0, school: { ...data.school, totalStudents: 0 }, groups: [] }, undefined, false), true);
  assert.equal(isSchoolStarting({ ...data, activeStudents: 0, groups: [] }, undefined, false), false);
  const html = renderToStaticMarkup(<HomeWelcome name="Maria Silva" data={data} />);
  assert.match(html, /Olá, Maria/);
});
