import assert from "node:assert/strict";
import { it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AcademicMonthGrid } from "../../src/features/academic-calendar/month-grid.js";
import type { AcademicYear } from "../../src/features/academic-calendar/model.js";

const empty: AcademicYear = {
  periods: [],
  interruptions: [],
  events: [],
  closedDays: [],
  requests: [],
  planWarnings: [],
};
const base = {
  year: 2026,
  month: 6,
  entries: [],
  today: "2026-07-14",
  selected: null,
  onSelectDay: (): void => {},
};

void it("keeps exactly one focusable day and marks today in a complete month", () => {
  const html = renderToStaticMarkup(<AcademicMonthGrid {...base} data={empty} />);
  assert.equal((html.match(/data-date="2026-07-/gu) ?? []).length, 31);
  assert.equal((html.match(/tabindex="0"/gu) ?? []).length, 1);
  assert.match(
    html,
    /<button(?=[^>]*data-date="2026-07-14")(?=[^>]*aria-current="date")(?=[^>]*tabindex="0")[^>]*>/u,
  );
});

void it("prioritizes a holiday over vacation while retaining the vacation marker", () => {
  const data = {
    ...empty,
    closedDays: [{ id: "holiday", date: new Date("2026-07-14Z"), reason: "Feriado local" }],
  };
  const html = renderToStaticMarkup(
    <AcademicMonthGrid
      {...base}
      data={data}
      vacations={{ before: null, after: { from: "2026-07-01", through: "2026-07-31" } }}
    />,
  );
  assert.match(
    html,
    /<button(?=[^>]*data-date="2026-07-14")(?=[^>]*data-kind="holiday")(?=[^>]*data-vacation="after")(?=[^>]*aria-label="[^"]*Feriado local")[^>]*>/u,
  );
  assert.match(html, /<button(?=[^>]*data-date="2026-07-15")(?=[^>]*data-kind="vacation")[^>]*>/u);
});

void it("selects the requested day and disables unavailable dates", () => {
  const html = renderToStaticMarkup(
    <AcademicMonthGrid {...base} selected="2026-07-03" unavailable compact />,
  );
  assert.match(
    html,
    /<button(?=[^>]*data-date="2026-07-03")(?=[^>]*aria-pressed="true")(?=[^>]*tabindex="0")(?=[^>]*disabled="")[^>]*>/u,
  );
  assert.match(html, /Datas indisponíveis/u);
});
