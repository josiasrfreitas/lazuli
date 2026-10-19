import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ScheduleCalendar } from "../../src/components/schedule-calendar.js";
import type { ScheduleCalendarProps } from "../../src/components/schedule-calendar/types.js";

const props: ScheduleCalendarProps = {
  date: "2026-10-19",
  view: "week",
  events: [
    {
      id: "meeting",
      title: "Reunião pedagógica",
      date: "2026-10-19",
      startTime: "09:00",
      endTime: "10:00",
    },
  ],
  onDateChange: () => {},
  onViewChange: () => {},
  toolbar: false,
};

void test("loading preserves weekday headings and time slots, with a pencil instead of stale events", () => {
  const html = renderToStaticMarkup(
    createElement(ScheduleCalendar, { ...props, status: "loading" }),
  );
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /lz-pencil-loader/);
  assert.match(html, /Carregando agenda/);
  assert.equal((html.match(/class="rbc-header[" ]/g) ?? []).length, 7);
  assert.match(html, />08:00</);
  assert.match(html, />19:00</);
  assert.doesNotMatch(html, /Reunião pedagógica/);
  assert.doesNotMatch(html, /Nenhum compromisso/);
});

void test("ready calendars display the returned events without a loading indicator", () => {
  const html = renderToStaticMarkup(createElement(ScheduleCalendar, { ...props, status: "ready" }));
  assert.match(html, /aria-busy="false"/);
  assert.match(html, /Reunião pedagógica/);
  assert.doesNotMatch(html, /lz-pencil-loader/);
});
