import assert from "node:assert/strict";
import { it } from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  HomeWelcome,
  HomeError,
  TodayAgenda,
  type HomeData,
} from "../../src/features/admin-home/home-parts.js";
import { HomeQueue } from "../../src/features/admin-home/home-queue.js";
import { BusinessSummary } from "../../src/features/admin-home/home-business.js";
import { Trend } from "../../src/features/admin-home/home-metrics.js";
import { isSchoolStarting } from "../../src/features/admin-home/home-start.js";
import {
  departureDayLabel,
  prioritizedWork,
  workPriority,
} from "../../src/features/admin-home/home-work-model.js";
import { LeadConversion } from "../../src/features/admin-home/home-audience.js";
import { pendingWork } from "../../src/features/admin-home/home-pending-model.js";
import { CoveragePagination } from "../../src/features/admin-home/home-pending-coverage.js";
import { HomeSummaryLoading } from "../../src/features/admin-home/home-summary-loading.js";

Object.assign(globalThis, { React });
const emptyMetric = { value: 0, previous: 0, series: [{ month: "2026-10", value: 0 }] };
const data: HomeData = {
  today: "2026-10-23",
  updatedAt: "2026-10-23T15:00:00Z",
  name: "Maria Silva",
  activeStudents: 120,
  studentAges: [
    { id: "children", label: "Crianças", count: 0 },
    { id: "teens", label: "Adolescentes", count: 120 },
    { id: "adults", label: "Adultos", count: 0 },
    { id: "unknown", label: "Não informada", count: 0 },
  ],
  leadConversion: { month: "2026-10", leads: 0, converted: 0 },
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
void it("shows no conversion rate when the month has no leads", () => {
  const empty = renderToStaticMarkup(<LeadConversion data={data.leadConversion} />);
  assert.match(empty, /Sem leads cadastrados no mês/);
  assert.doesNotMatch(empty, />0%<|NaN|Infinity/);

  const converted = renderToStaticMarkup(
    <LeadConversion data={{ month: "2026-10", leads: 4, converted: 1 }} />,
  );
  assert.match(converted, /25%/);
  assert.match(converted, /1<\/strong> com aluno vinculado/);
});

void it("orders home pending work by urgency instead of queue volume", () => {
  const ranked = pendingWork({
    ...data,
    groups: [
      { ...queue("students"), total: 200 },
      queue("coverage", { kind: "departure", date: "2026-10-23" }),
    ],
  });
  assert.deepEqual(
    ranked.map((work) => work.id),
    ["coverage", "students"],
  );
  assert.equal(ranked[0]?.score, 7);
  assert.equal(ranked[1]?.score, 4);
});

void it("offers another coverage page when five teachers have affected classes", () => {
  const html = renderToStaticMarkup(
    <CoveragePagination total={5} page={1} busy={false} onPageChange={() => {}} />,
  );
  assert.match(html, /5 professores com turmas sem professor/);
  assert.match(html, /Página 1 de 2/);
  const nextButton = html.match(/<button[^>]*><span[^>]*>Próxima<\/span><\/button>/u)?.[0];
  assert.ok(nextButton);
  assert.doesNotMatch(nextButton, /\sdisabled=""/u);
});

void it("shows departure distance across future, current and past school dates", () => {
  assert.equal(departureDayLabel("2026-10-20", "2026-10-25"), "Daqui a 5 dias");
  assert.equal(departureDayLabel("2026-10-20", "2026-10-20"), "Hoje");
  assert.equal(departureDayLabel("2026-10-20", "2026-10-15"), "Há 5 dias");
});

void it("keeps loading and failed dashboard data distinct", () => {
  const loading = renderToStaticMarkup(<HomeSummaryLoading />);
  assert.match(loading, /Carregando indicadores da escola/);
  assert.doesNotMatch(loading, /Nenhuma pendência/);
  const failed = renderToStaticMarkup(
    <HomeError retry={() => {}}>Não foi possível carregar o Início.</HomeError>,
  );
  assert.match(failed, /role="alert"/);
  assert.match(failed, /Não foi possível carregar o Início/);
  assert.match(failed, /Tentar novamente/);
  const stale = renderToStaticMarkup(
    <HomeError retry={() => {}}>
      Não foi possível atualizar o Início. Os dados exibidos podem estar desatualizados.
    </HomeError>,
  );
  assert.match(stale, /podem estar desatualizados/);
});

void it("prioritizes a teacher departure before intake volume and finance", () => {
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
      title: "Turmas sem professor",
      description: "Cobertura.",
      area: "school",
      attention: true,
      total: 1,
      items: [
        {
          id: "teacher-today",
          title: "Professora de hoje",
          date: data.today,
          detail: "2 turmas precisam de professor",
          action: { kind: "link", href: "/turmas?professor=teacher-today" },
          timing: { kind: "departure", date: data.today },
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
  assert.match(html, /Professores com turmas a reatribuir/);
  assert.match(html, /Ver turmas/);
  assert.ok(html.indexOf("Ver turmas") < html.indexOf("Alunos sem turma"));
  assert.match(html, /Conduzir as aulas/);
  assert.match(html, /Preparar a entrada em turma/);
  assert.doesNotMatch(html, /Primeiros contratos|>300</);
  assert.match(html, /id="home-priority-title">Turma sem professor/);
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
void it("prioritizes the nearest entry over a later teacher departure", () => {
  const coverage = {
    ...queue("coverage", { kind: "departure", date: "2026-10-29" }),
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
        timing: { kind: "departure" as const, date: "2026-10-25" },
      },
    ],
  };
  assert.equal(
    prioritizedWork({ ...data, groups: [dayAfter, semester] })[0]?.group.kind,
    "semester",
  );
});
void it("changes a teacher departure from upcoming to today to elapsed", () => {
  const coverage = queue("coverage", { kind: "departure", date: "2026-10-23" });
  assert.equal(
    workPriority(coverage, { today: "2026-10-20", updatedAt: "2026-10-20T15:00:00Z" }).tone,
    "warning",
  );
  assert.equal(workPriority(coverage, data).state, "today");
  const elapsed = workPriority(coverage, { ...data, today: "2026-10-28" });
  assert.equal(elapsed.state, "date-passed");
  assert.equal(elapsed.tone, "destructive");
  assert.equal(elapsed.label, "Há 5 dias");
  const html = renderToStaticMarkup(
    <HomeQueue
      data={{ ...data, today: "2026-10-28", groups: [coverage] }}
      selected={null}
      select={() => {}}
      open={() => {}}
    />,
  );
  assert.match(html, /Há 5 dias/);
  assert.match(html, /Defina outro professor para cada turma afetada pela saída/);
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
    isSchoolStarting({
      data: {
        ...data,
        activeStudents: 0,
        school: { ...data.school, totalStudents: 0 },
        groups: [],
      },
      business: undefined,
      finance: false,
    }),
    true,
  );
  assert.equal(
    isSchoolStarting({
      data: { ...data, activeStudents: 0, groups: [] },
      business: undefined,
      finance: false,
    }),
    false,
  );
  const html = renderToStaticMarkup(<HomeWelcome name="Maria Silva" data={data} />);
  assert.match(html, /Olá, Maria/);
});
