import assert from "node:assert/strict";
import { it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
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
  planWarnings: [],
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
  setPeriod: noop,
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
    <CalendarContextPanel {...context} period={null} date={null} />,
  );
  assert.match(empty, /Definir semestres/u);
  assert.match(empty, /Nenhuma data cadastrada/u);
});

void it("keeps an open editor in the context slot and disables new-event creation", () => {
  const html = renderToStaticMarkup(
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
  const html = renderToStaticMarkup(
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
