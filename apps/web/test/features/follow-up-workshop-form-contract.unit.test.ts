import assert from "node:assert/strict";
import { it } from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkshopActionForm } from "../../src/features/students/follow-up-workshop/action-form.js";
import {
  initialWorkshopState,
  type ActionKind,
} from "../../src/features/students/follow-up-workshop/model.js";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
for (const kind of [
  "occurrence",
  "create",
  "note",
  "start",
  "conclude",
  "reopen",
  "assign",
  "link",
  "complement",
] satisfies ActionKind[]) {
  void it(`${kind} exposes a real form and labeled controls without autofill or native date subfields`, () => {
    const state = initialWorkshopState();
    const markup = renderToStaticMarkup(
      React.createElement(WorkshopActionForm, {
        kind,
        row: state.cases[0],
        sourceId: "",
        occurrences: state.occurrences,
        onSave: () => {},
        onClose: () => {},
      }),
    );
    assert.equal((markup.match(/<form\b/g) ?? []).length, 1);
    assert.match(markup, /id="workshop-action"/);
    assert.match(markup, /name="(?:title|body|workshop-occurrence)"/);
    for (const tag of markup.match(/<(?:input|textarea)\b[^>]*>/g) ?? []) {
      if (/type="checkbox"/.test(tag)) continue;
      assert.match(tag, /name="[^"]+"/);
      assert.match(tag, /placeholder="[^"]+"/);
      assert.match(tag, /autoComplete="off"/i);
      assert.doesNotMatch(tag, /type="date"/);
    }
  });
}
