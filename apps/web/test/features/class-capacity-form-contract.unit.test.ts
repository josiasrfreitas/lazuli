import assert from "node:assert/strict";
import { it } from "node:test";
import { createElement } from "react";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CapacityForm } from "../../src/features/classes/capacity-dialog.js";
import { classCapacityInputSchema } from "@lazuli/validators";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

void it("keeps capacity numeric, labelled and keyboard submittable, with an explicit over-capacity notice", () => {
  const markup = renderToStaticMarkup(
    createElement(CapacityForm, {
      value: "10",
      occupancy: 16,
      error: null,
      pending: false,
      first: { current: null },
      change: () => {},
      submit: () => {},
    }),
  );
  assert.match(markup, /<form[^>]*id="class-capacity-form"/u);
  assert.match(markup, /for="class-capacity"/u);
  const input = markup.match(/<input[^>]*name="capacity"[^>]*>/u)?.[0] ?? "";
  assert.match(input, /inputMode="numeric"/u);
  assert.match(input, /autoComplete="off"/iu);
  assert.match(input, /placeholder="Ex.: 16"/u);
  assert.match(markup, /A turma ficará acima da capacidade informada/u);
  for (const capacity of [0, -1, 1.5, 501, NaN]) {
    assert.equal(
      classCapacityInputSchema.safeParse({ id: "4a43db89-40c1-4dde-a2de-026e368e1a36", capacity })
        .success,
      false,
    );
  }
});
