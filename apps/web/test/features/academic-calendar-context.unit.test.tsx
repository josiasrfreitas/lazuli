import assert from "node:assert/strict";
import { it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { renderWithQueries } from "../support/query-render.js";
import { CalendarContextPanel } from "../../src/features/academic-calendar/context-panel.js";
import { AcademicCalendarWorkspace } from "../../src/features/academic-calendar/workspace.js";
import type { AcademicYear } from "../../src/features/academic-calendar/model.js";
import type { AcademicCalendarNavigation } from "../../src/features/academic-calendar/navigation.js";

const noop = (): void => {};
const period = {
  id: "semester",
  name: "Segundo semestre",
  startDate: new Date("2026-08-01Z"),
  endDate: new Date("2026-12-15Z"),
  updatedAt: new Date("2026-01-01Z"),
};
const data: AcademicYear = {
  periods: [period],
  events: [],
  closedDays: [],
  interruptions: [],
  requests: [],
};
const context = {
  data,
  entries: [],
  year: 2026,
  month: 6,
  date: "2026-07-14",
  today: "2026-07-14",
  period,
  vacations: { before: { from: "2026-07-01", through: "2026-07-31" }, after: null },
  onSelectDate: noop,
  onEdit: noop,
  onCreate: noop,
  onInterruption: noop,
  onDayAgenda: noop,
  onClear: noop,
  onConfigure: noop,
};
const navigation: AcademicCalendarNavigation = {
  year: 2026,
  periodId: period.id,
  location: { month: 6, date: null, daily: false },
  setYear: noop,
  setMonth: noop,
  setLocation: noop,
};
const workspace = {
  data,
  navigation,
  period,
  periods: [period],
  refreshing: false,
  onCreate: noop,
  onEdit: noop,
  onConfigure: noop,
  onInterruption: noop,
};

void it("keeps holiday status above vacation and hides the daily agenda shortcut in daily mode", () => {
  const closed = {
    ...data,
    closedDays: [{ id: "closed", date: new Date("2026-07-14Z"), reason: "Feriado local" }],
  };
  const html = renderToStaticMarkup(<CalendarContextPanel {...context} data={closed} daily />);
  assert.match(html, /data-kind="holiday"/u);
  assert.match(html, /A suspensão inclui aulas, atendimentos e experimentais/u);
  assert.doesNotMatch(html, /Ver agenda do dia/u);
  assert.match(html, /Adicionar evento neste dia/u);
});

void it("distinguishes unavailable context from loading and empty periods", () => {
  const unavailable = renderToStaticMarkup(<CalendarContextPanel {...context} unavailable />);
  assert.match(unavailable, /Datas indisponíveis/u);
  assert.doesNotMatch(unavailable, /Adicionar evento/u);
  const empty = renderToStaticMarkup(
    <CalendarContextPanel {...context} data={{ ...data, periods: [] }} period={null} date={null} />,
  );
  assert.match(empty, /Definir semestres/u);
  assert.match(empty, /Nenhuma data cadastrada/u);
});

void it("keeps an open editor in the context slot and disables new-event creation", () => {
  const html = renderWithQueries(
    <AcademicCalendarWorkspace {...workspace} editor={<p>Editor aberto</p>} />,
  );
  assert.match(html, /<aside[^>]*data-editing="true"[^>]*><p>Editor aberto<\/p><\/aside>/u);
  assert.match(
    html,
    /<button(?=[^>]*disabled="")[^>]*>(?:(?!<\/button>)[\s\S])*Novo evento<\/span><\/button>/u,
  );
  assert.match(html, /data-date="2026-07-14"/u);
});

void it("uses the supplied daily agenda instead of month cells", () => {
  const dailyNavigation = {
    ...navigation,
    location: { month: 6, date: "2026-07-14", daily: true },
  };
  const html = renderWithQueries(
    <AcademicCalendarWorkspace
      {...workspace}
      navigation={dailyNavigation}
      dailyAgenda={<p>Agenda selecionada</p>}
    />,
  );
  assert.match(html, /Agenda selecionada/u);
  assert.doesNotMatch(html, /data-date=/u);
  assert.doesNotMatch(html, /aria-label="Mês anterior"/u);
});

void it("renders only registered months in the annual view with year navigation and no period filter", () => {
  const html = renderWithQueries(
    <AcademicCalendarWorkspace
      {...workspace}
      period={null}
      navigation={{
        ...navigation,
        periodId: null,
        location: { month: null, date: null, daily: false },
      }}
    />,
  );
  assert.match(html, /aria-label="Ano anterior"/u);
  assert.match(html, /aria-label="Próximo ano"/u);
  assert.doesNotMatch(html, /Todos os períodos|data-slot="segmented-control"/u);
  assert.match(html, /Períodos de 2026/u);
  assert.match(html, /data-date="2026-08-01"/u);
  assert.match(html, /data-date="2026-12-15"/u);
  assert.match(html, /data-date="2026-07-01"[^>]*data-kind="vacation"/u);
  assert.doesNotMatch(html, /data-date="2026-01-01"|data-date="2027-/u);
});

void it("shows an empty year with semester setup instead of twelve unrelated months", () => {
  const html = renderWithQueries(
    <AcademicCalendarWorkspace
      {...workspace}
      data={{ ...data, periods: [] }}
      period={null}
      periods={[]}
      navigation={{
        ...navigation,
        year: 2027,
        periodId: null,
        location: { month: null, date: null, daily: false },
      }}
    />,
  );
  assert.match(html, /Nenhum período em 2027/u);
  assert.match(html, /Definir semestres/u);
  assert.doesNotMatch(html, /data-date=/u);
});

void it("shows both semesters and the confirmed vacation month between them in the annual view", () => {
  const first = {
    ...period,
    id: "first",
    name: "2026.1",
    startDate: new Date("2026-02-01Z"),
    endDate: new Date("2026-06-30Z"),
  };
  const periods = [first, period];
  const html = renderWithQueries(
    <AcademicCalendarWorkspace
      {...workspace}
      data={{ ...data, periods }}
      periods={periods}
      period={null}
      navigation={{
        ...navigation,
        periodId: null,
        location: { month: null, date: null, daily: false },
      }}
    />,
  );
  assert.match(html, /data-date="2026-02-01"/u);
  assert.match(html, /data-date="2026-07-15"[^>]*data-kind="vacation"/u);
  assert.match(html, /data-date="2026-12-15"/u);
  assert.match(html, /Férias acadêmicas/u);
  assert.doesNotMatch(html, /Fora de Segundo semestre/u);
});

void it("loads with month-shaped placeholders and retains the requested year", () => {
  const html = renderWithQueries(
    <AcademicCalendarWorkspace
      {...workspace}
      data={undefined}
      period={null}
      periods={[]}
      navigation={{
        ...navigation,
        year: 2027,
        location: { month: null, date: null, daily: false },
      }}
    />,
  );
  assert.match(html, /role="status" aria-label="Carregando calendário"/u);
  assert.match(html, />2027<\/h2>/u);
  assert.match(html, /class="month"[\s\S]*class="weekdays"[\s\S]*class="days"/u);
  assert.doesNotMatch(html, /h-32 w-full|Nenhum período em/u);
});

void it("does not keep loading or offer semester setup when the year request failed", () => {
  const html = renderWithQueries(
    <AcademicCalendarWorkspace
      {...workspace}
      data={undefined}
      unavailable
      period={null}
      periods={[]}
      navigation={{ ...navigation, location: { month: null, date: null, daily: false } }}
    />,
  );
  assert.match(html, /Datas indisponíveis/u);
  assert.doesNotMatch(html, /aria-label="Carregando calendário"|Definir semestres/u);
});
