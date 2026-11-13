import assert from "node:assert/strict";
import { it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AcademicEventFields,
  eventDraftSchema,
} from "../../src/features/academic-calendar/event-fields.js";

const values = {
  title: "Encontro cultural",
  description: "",
  startDate: "20/11/2026",
  startTime: "18:00",
  endDate: "20/11/2026",
  endTime: "20:00",
};

void it("keeps event dates and times as single masked keyboard controls", () => {
  const markup = renderToStaticMarkup(
    createElement(AcademicEventFields, {
      values,
      errors: {},
      pending: false,
      change: () => {},
      submit: () => {},
    }),
  );
  assert.equal((markup.match(/<form\b/g) ?? []).length, 1);
  assert.match(markup, /id="academic-event"/);
  assert.doesNotMatch(markup, /type="(?:date|datetime-local|time)"/);
  const controls = markup.match(/<(?:input|textarea)\b[^>]*>/g) ?? [];
  assert.equal(controls.length, 6);
  for (const control of controls) {
    assert.match(control, /name="[^"]+"/);
    assert.match(control, /placeholder="[^"]+"/);
    assert.match(control, /autoComplete="off"/i);
  }
});

void it("rejects invalid dates, times and nonpositive event durations", () => {
  assert.equal(eventDraftSchema.safeParse(values).success, true);
  for (const invalid of [
    { title: "  " },
    { startDate: "31/02/2026" },
    { startTime: "24:00" },
    { endTime: "18:00" },
    { endDate: "19/11/2026" },
  ]) {
    assert.equal(eventDraftSchema.safeParse({ ...values, ...invalid }).success, false);
  }
  assert.equal(
    eventDraftSchema.safeParse({ ...values, endDate: "21/11/2026", endTime: "00:00" }).success,
    true,
  );
});
