import assert from "node:assert/strict";
import { it } from "node:test";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OutcomeFields } from "../../src/features/admissions/visit-outcome.js";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

void it("cancellation exposes a labelled reason and points to it when the reason is missing", () => {
  const markup = renderToStaticMarkup(
    createElement(OutcomeFields, {
      cancel: true,
      status: "ATTENDED",
      notes: "",
      error: "Informe o motivo do cancelamento.",
      onStatus: () => {},
      onNotes: () => {},
    }),
  );
  const input = markup.match(/<input\b[^>]*>/u)?.[0] ?? "";
  assert.match(input, /name="outcome-notes"/u);
  assert.match(input, /aria-invalid="true"/u);
  assert.match(input, /placeholder="Por que a aula será cancelada\?"/u);
  assert.match(markup, /Motivo/u);
  assert.doesNotMatch(markup, /aria-label="Comparecimento"/u);
});

void it("attendance offers both outcomes without implying an enrollment", () => {
  const markup = renderToStaticMarkup(
    createElement(OutcomeFields, {
      cancel: false,
      status: "ATTENDED",
      notes: "",
      error: "",
      onStatus: () => {},
      onNotes: () => {},
    }),
  );
  assert.match(markup, /aria-label="Comparecimento"/u);
  assert.match(markup, /Não compareceu/u);
  assert.match(markup, /O comparecimento não efetiva uma matrícula/u);
  assert.match(markup, /placeholder="Como foi a experiência\?"/u);
});
