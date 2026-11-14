import { initialEventDraft } from "../../src/features/academic-calendar/event-form-model.js";
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

void it("prefills school-local dates and times across a UTC year boundary", () => {
  const draft = initialEventDraft({
    item: {
      id: "new-year-event",
      title: "Virada",
      description: null,
      startsAt: new Date("2027-01-01T01:30:00Z"),
      endsAt: new Date("2027-01-01T03:30:00Z"),
      updatedAt: new Date("2026-12-01T00:00:00Z"),
    },
    initialDate: "2026-11-20",
  });
  assert.deepEqual(draft, {
    title: "Virada",
    description: "",
    startDate: "31/12/2026",
    startTime: "22:30",
    endDate: "01/01/2027",
    endTime: "00:30",
  });
});

void it("prefills only dates for a new event and leaves an unspecified draft empty", () => {
  assert.deepEqual(initialEventDraft({ initialDate: "2026-11-20" }), {
    title: "",
    description: "",
    startDate: "20/11/2026",
    startTime: "",
    endDate: "20/11/2026",
    endTime: "",
  });
  assert.deepEqual(initialEventDraft({}), {
    title: "",
    description: "",
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
  });
});
