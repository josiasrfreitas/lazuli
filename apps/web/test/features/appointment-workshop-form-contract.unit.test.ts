import assert from "node:assert/strict";
import { it } from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ScheduleForm } from "../../src/features/students/follow-up-workshop/appointment-schedule-preview.js";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
void it("offers a real scheduling form with named date, time and reason controls", () => {
  const markup = renderToStaticMarkup(
    React.createElement(ScheduleForm, { onClose: () => {}, onSave: () => {} }),
  );
  assert.equal((markup.match(/<form\b/g) ?? []).length, 1);
  assert.match(markup, /id="workshop-schedule"/);
  for (const name of [
    "appointment-date",
    "appointment-start",
    "appointment-end",
    "plannedContent",
  ]) {
    assert.match(markup, new RegExp(`name="${name}"`));
  }
  assert.doesNotMatch(markup, /type="date"/);
  assert.match(markup, /Motivo do atendimento/);
});
