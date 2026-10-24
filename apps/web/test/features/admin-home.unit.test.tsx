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
import { BusinessSummary } from "../../src/features/admin-home/home-business.js";
import { Trend } from "../../src/features/admin-home/home-metrics.js";
import { isSchoolStarting } from "../../src/features/admin-home/home-start.js";
import { prioritizedWork, workPriority } from "../../src/features/admin-home/home-work-model.js";

Object.assign(globalThis, { React });
const emptyMetric = { value: 0, previous: 0, series: [{ month: "2026-10", value: 0 }] };
const data: HomeData = {
  today: "2026-10-23",
  updatedAt: "2026-10-23T15:00:00Z",
  name: "Maria Silva",
  activeStudents: 120,
  canViewFinance: false,
  agenda: { total: 0, items: [] },
  school: {
    month: "2026-10",
    through: "2026-10-23",
    previousThrough: "2026-09-23",
    partial: true,
    totalStudents: 120,
    students: emptyMetric,
    enrollments: emptyMetric,
    trials: emptyMetric,
  },
  groups: [
    {
      kind: "lessons",
      title: "Aulas por registrar",
      description: "Encontros encerrados.",
      area: "school",
      attention: true,
      total: 2,
      historyTotal: 618,
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
void it("prioritizes upcoming teaching coverage before intake volume and finance", () => {
  const groups: HomeData["groups"] = [
    {
      kind: "contracts",
      title: "Primeiros contratos",
      description: "Contratos.",
      area: "finance",
      attention: false,
      total: 300,
      items: [],
    },
    {
      kind: "students",
      title: "Alunos sem turma",
      description: "Turmas.",
      area: "school",
      attention: false,
      total: 200,
      items: [],
    },
    ...data.groups.filter((group) => group.kind === "lessons"),
    {
      kind: "coverage",
      title: "Aulas sem professor",
      description: "Cobertura.",
      area: "school",
      attention: true,
      total: 1,
      items: [
        {
          id: "class-today",
          title: "Turma de hoje",
          date: data.today,
          detail: "Sem professor",
          action: { kind: "link", href: "/turmas" },
          timing: { kind: "meeting", date: data.today, startTime: "14:00", endTime: "15:00" },
        },
      ],
    },
  ];
  const html = renderToStaticMarkup(
    <HomeQueue
      data={{ ...data, canViewFinance: true, groups }}
      selected={null}
      select={() => {}}
      open={() => {}}
    />,
  );
  assert.match(html, /1 aula sem professor/);
  assert.match(html, /Definir professor/);
  assert.ok(html.indexOf("Definir professor") < html.indexOf("Alunos sem turma"));
  assert.match(html, /Conduzir as aulas/);
  assert.match(html, /Preparar a entrada em turma/);
  assert.doesNotMatch(html, /Primeiros contratos|>300</);
  assert.match(html, /id="home-priority-title">Defina quem conduz a próxima aula/);
});

function queue(
  kind: HomeData["groups"][number]["kind"],
  timing?: HomeData["groups"][number]["items"][number]["timing"],
): HomeData["groups"][number] {
  return {
    kind,
    title: kind,
    description: kind,
    area: "school",
    attention: false,
    total: 1,
    items: [
      {
        id: kind,
        title: `Caso ${kind}`,
        detail: "Caso de teste",
        date: null,
        action: { kind: "link", href: "/turmas" },
        ...(timing && { timing }),
      },
    ],
  };
}
void it("prioritizes the nearest entry over larger teaching queues later in the week", () => {
  const coverage = {
    ...queue("coverage", {
      kind: "meeting",
      date: "2026-10-29",
      startTime: "09:00",
      endTime: "10:00",
    }),
    total: 200,
  };
  const semester = queue("semester", { kind: "entry", date: "2026-10-24" });
  const ranked = prioritizedWork({
    ...data,
    groups: [coverage, semester, { ...queue("contracts"), total: 500 }],
  });
  assert.deepEqual(
    ranked.map((work) => work.group.kind),
    ["semester", "coverage"],
  );
  assert.equal(ranked[0]?.label, "Entrada prevista amanhã");
  const dayAfter = {
    ...coverage,
    items: [
      {
        ...coverage.items[0]!,
        timing: {
          kind: "meeting" as const,
          date: "2026-10-25",
          startTime: "09:00",
          endTime: "10:00",
        },
      },
    ],
  };
  assert.equal(
    prioritizedWork({ ...data, groups: [dayAfter, semester] })[0]?.group.kind,
    "semester",
  );
});
void it("changes the same uncovered meeting from preparation to today to in-progress", () => {
  const coverage = queue("coverage", {
    kind: "meeting",
    date: "2026-10-23",
    startTime: "14:00",
    endTime: "15:00",
  });
  assert.equal(
    workPriority(coverage, { today: "2026-10-20", updatedAt: "2026-10-20T15:00:00Z" }).tone,
    "neutral",
  );
  assert.equal(workPriority(coverage, data).state, "today");
  const started = workPriority(coverage, { ...data, updatedAt: "2026-10-23T17:00:00Z" });
  assert.equal(started.state, "ongoing");
  assert.equal(started.tone, "destructive");
  assert.equal(started.headline, "A aula começou sem professor definido");
  const html = renderToStaticMarkup(
    <HomeQueue
      data={{ ...data, updatedAt: "2026-10-23T17:00:00Z", groups: [coverage] }}
      selected={null}
      select={() => {}}
      open={() => {}}
    />,
  );
  assert.match(html, /14:00/);
  assert.match(html, /Aula em andamento/);
});
void it("treats a past entry date as a publication issue, without alarming future planning", () => {
  const passed = workPriority(queue("semester", { kind: "entry", date: "2026-10-22" }), data);
  assert.equal(passed.state, "date-passed");
  assert.equal(passed.tone, "destructive");
  assert.equal(passed.action, "Revisar datas de entrada");
  const planned = workPriority(queue("semester", { kind: "entry", date: "2027-02-01" }), data);
  assert.equal(planned.state, "plan");
  assert.equal(planned.tone, "neutral");
  assert.ok(planned.rank > workPriority(queue("students"), data).rank);
});
void it("uses the actual school-date wait without inventing an overdue deadline", () => {
  // 02:30 UTC belongs to October 16 in the school, therefore seven days of waiting.
  const waiting = queue("placement", { kind: "waiting", since: "2026-10-17T02:30:00Z" });
  const work = workPriority(waiting, data);
  assert.equal(work.evidence, "Prova mais antiga recebida há 7 dias");
  assert.equal(work.tone, "warning");
  assert.doesNotMatch(`${work.label} ${work.headline}`, /atras|vencid|prazo/iu);
  const recent = workPriority(
    queue("placement", { kind: "waiting", since: "2026-10-23T13:00:00Z" }),
    data,
  );
  assert.equal(recent.tone, "neutral");
  assert.ok(work.rank < recent.rank);
  const unknown = workPriority(queue("students"), data);
  assert.equal(unknown.tone, "neutral");
  assert.doesNotMatch(unknown.evidence, /dias|hoje|atras/iu);
});
void it("keeps recent pedagogical work actionable and historical volume separate", () => {
  const html = renderToStaticMarkup(
    <HomeQueue
      data={{
        ...data,
        groups: [
          ...data.groups,
          {
            kind: "placement",
            title: "Nivelamentos",
            description: "Correções",
            area: "admissions",
            attention: false,
            total: 0,
            items: [],
          },
        ],
      }}
      selected={null}
      select={() => {}}
      open={() => {}}
    />,
  );
  assert.match(html, /Conferir registros de aula/);
  assert.match(html, /professores responsáveis/);
  assert.match(html, /Alunos sem turma/);
  assert.match(html, /Definir turmas/);
  assert.match(html, /Registros anteriores aos últimos 7 dias/);
  assert.match(html, /618 aulas/);
  assert.doesNotMatch(html, /Nivelamentos|Contratos|Recebido|bloqueado|R\$/);
});
void it("collapses pedagogical triage when only contractual work remains", () => {
  const contract: HomeData["groups"][number] = {
    kind: "contracts",
    title: "Primeiros contratos",
    description: "Contratos.",
    area: "finance",
    attention: false,
    total: 10,
    items: [],
  };
  const quiet = renderToStaticMarkup(
    <HomeQueue
      data={{ ...data, groups: [contract] }}
      selected={null}
      select={() => {}}
      open={() => {}}
    />,
  );
  assert.match(quiet, /Nenhuma pendência pedagógica atual/);
  assert.doesNotMatch(quiet, /<h[23]|>10</);
  const failure = renderToStaticMarkup(
    <BusinessSummary
      data={undefined}
      groups={[contract]}
      pending={false}
      error
      retry={() => {}}
      select={() => {}}
    />,
  );
  assert.match(failure, /Não foi possível atualizar o financeiro/);
  assert.match(failure, /Preparar contratos/);
  assert.doesNotMatch(failure, /R\$|Carregando resumo financeiro/);
});
void it("keeps the agenda useful after the day's last appointment and distinguishes failure from loading", () => {
  const html = renderToStaticMarkup(<TodayAgenda data={data} compact open={() => {}} />);
  assert.match(html, /Sem compromissos restantes hoje/);
  assert.doesNotMatch(html, /<aside|<h2/);
  assert.match(html, /href="\/aulas\?dia=2026-10-23&amp;visao=dia"/);
  const error = renderToStaticMarkup(
    <TodayAgenda data={undefined} loading={false} open={() => {}} />,
  );
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
  assert.equal(
    isSchoolStarting(
      { ...data, activeStudents: 0, school: { ...data.school, totalStudents: 0 }, groups: [] },
      undefined,
      false,
    ),
    true,
  );
  assert.equal(
    isSchoolStarting({ ...data, activeStudents: 0, groups: [] }, undefined, false),
    false,
  );
  const html = renderToStaticMarkup(<HomeWelcome name="Maria Silva" data={data} />);
  assert.match(html, /Olá, Maria/);
});
