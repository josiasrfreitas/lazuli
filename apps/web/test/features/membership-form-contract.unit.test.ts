import assert from "node:assert/strict";
import { it } from "node:test";
import * as React from "react";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MembershipFields } from "../../src/features/classes/membership-fields.js";

(globalThis as typeof globalThis & { React: typeof React }).React = React;
type Props = ComponentProps<typeof MembershipFields>;
const state: Props["state"] = {
  search: "Ana",
  selectedId: "",
  stageId: "",
  date: "08/10/2026",
  error: null,
  pending: false,
  searching: false,
  searchFailed: false,
  students: [],
  paused: [],
  setError: () => {},
  setSearch: () => {},
  setSelectedId: () => {},
  setStageId: () => {},
  setDate: () => {},
  submit: () => {},
};

function render(overrides: Partial<Props> = {}): string {
  return renderToStaticMarkup(
    createElement(MembershipFields, {
      mode: "ENTRY",
      scheduleType: "REGULAR",
      state,
      options: { teachers: [], semesters: [], stages: [] },
      ...overrides,
    }),
  );
}

void it("combines student search and selection in one named control beside a calendar date", () => {
  const markup = render();
  const inputs = (markup.match(/<input\b[^>]*>/gu) ?? []).filter((tag) =>
    tag.includes('data-slot="input"'),
  );
  assert.equal(inputs.length, 2);
  assert.match(inputs[0] ?? "", /role="combobox"/u);
  assert.match(inputs[0] ?? "", /name="studentSearch"/u);
  assert.match(inputs[1] ?? "", /name="entryDate"/u);
  assert.match(inputs[1] ?? "", /type="date"/u);
  assert.match(inputs[1] ?? "", /value="2026-10-08"/u);
  assert.doesNotMatch(markup, /<select|Entrada na turma/u);
  for (const tag of inputs) {
    assert.match(tag, /placeholder="[^"]+"/u);
    assert.match(tag, /autoComplete="off"|autocomplete="off"/u);
  }
});

void it("keeps the individual stage choice available for personalized classes", () => {
  const markup = render({
    scheduleType: "PERSONALIZED",
    state: { ...state, stageId: "stage" },
    options: {
      teachers: [],
      semesters: [],
      stages: [{ id: "stage", name: "Essentials 1", internalCode: "E1" }],
    },
  });
  assert.match(markup, /name="stageId"/u);
  assert.match(markup, /Etapa individual/u);
  assert.match(markup, /E1 · Essentials 1/u);
  assert.doesNotMatch(markup, /name="studentId"/u);
});

void it("preserves the prior placement explanation when returning a student", () => {
  const markup = render({ mode: "RETURN" });
  assert.match(markup, /nova colocação pedagógica e preserva o percurso anterior/u);
  assert.doesNotMatch(markup, /<select/u);
});

void it("keeps the paused student fixed for a contextual return", () => {
  const markup = render({ mode: "RETURN", sourceName: "Ana Beatriz" });
  assert.match(markup, /Ana Beatriz/u);
  assert.doesNotMatch(markup, /name="studentSearch"/u);
  assert.match(markup, /name="entryDate"/u);
  assert.match(markup, /preserva o percurso anterior/u);
});
