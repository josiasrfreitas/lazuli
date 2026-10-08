import assert from "node:assert/strict";
import { it } from "node:test";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ClassCreateFields } from "../../src/features/classes/create-fields.js";
import { initialClassDraft } from "../../src/features/classes/create-model.js";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

void it("offers teacher search and two masked schedule rows without a manual year", () => {
  const markup = renderToStaticMarkup(
    createElement(ClassCreateFields, {
      draft: initialClassDraft,
      change: () => {},
      errors: {},
      options: { teachers: [], semesters: [], stages: [] },
    }),
  );
  const inputs = markup.match(/<input\b[^>]*>/gu) ?? [];
  const teacher = inputs.find((tag) => tag.includes('name="teacherId"'));
  assert.match(teacher ?? "", /role="combobox"/u);
  assert.match(teacher ?? "", /placeholder="Buscar professor"/u);
  assert.doesNotMatch(markup, /name="year"|name="portalClassName"/u);
  assert.match(markup, /name="semesterId"/u);
  assert.match(markup, /name="sharedStageId"/u);
  for (const index of [0, 1]) {
    assert.match(markup, new RegExp(`name="weekday-${index}"`, "u"));
    for (const [field, placeholder] of [
      ["startTime", "19:00"],
      ["endTime", "20:30"],
    ]) {
      const input = inputs.find((tag) => tag.includes(`name="${field}-${index}"`));
      assert.match(input ?? "", new RegExp(`placeholder="${placeholder}"`, "u"));
      assert.match(input ?? "", /inputMode="numeric"|inputmode="numeric"/u);
      assert.match(input ?? "", /autoComplete="off"|autocomplete="off"/u);
      assert.match(input ?? "", /value=""/u);
    }
  }
});
