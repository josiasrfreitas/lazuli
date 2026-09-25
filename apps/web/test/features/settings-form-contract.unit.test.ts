import assert from "node:assert/strict";
import { it } from "node:test";

import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { SettingsForm } from "../../src/features/settings/settings-form.js";
import { SettingsPanel } from "../../src/features/settings/settings-panel.js";
import type { SettingsRow } from "../../src/features/settings/settings-model.js";

(globalThis as typeof globalThis & { React: typeof React }).React = React;
const FIELD_COUNT = 7;

function render(isPending = false): string {
  return renderToStaticMarkup(
    createElement(SettingsForm, {
      row: null,
      onCancel: () => {},
      onSaved: () => {},
      mutation: { isPending, mutateAsync: () => Promise.resolve(null) },
    }),
  );
}

const current: SettingsRow = {
  tuitionCeilingCents: 25_000,
  maximumDiscountPct: 20,
  punctualityDiscountPct: 0,
  tuitionFloorCents: 20_000,
  interestRatePctDaily: 0.1,
  interestRatePctMonthly: 2,
  cancellationFeePct: 10,
  materialPriceCents: 12_050,
  updatedAt: new Date("2026-09-24T15:00:00Z"),
  updatedByName: "Operador",
};

void it("opens with saved values and an Edit action instead of an active form", () => {
  const markup = renderToStaticMarkup(
    createElement(SettingsPanel, {
      row: current,
      mutation: { isPending: false, mutateAsync: () => Promise.resolve(null) },
    }),
  );
  assert.equal((markup.match(/<input\b/gu) ?? []).length, 0);
  assert.match(markup, />Editar</u);
  assert.match(markup, />R\$250</u);
  assert.match(markup, />R\$120,50</u);
  assert.match(markup, /R\$200/u);
  assert.match(markup, /Operador/u);
  assert.match(markup, /24\/09\/2026, 12:00/u);
});

void it("starts editing with the actual stored amounts and percentages", () => {
  const markup = renderToStaticMarkup(
    createElement(SettingsForm, {
      row: current,
      mutation: { isPending: false, mutateAsync: () => Promise.resolve(null) },
      onCancel: () => {},
      onSaved: () => {},
    }),
  );
  const values = (markup.match(/<input\b[^>]*>/gu) ?? []).map(
    (tag) => /value="([^"]*)"/u.exec(tag)?.[1],
  );
  assert.deepEqual(values, ["250,00", "20", "0", "0,1", "2", "10", "120,50"]);
  assert.match(markup, />Cancelar</u);
  assert.match(markup, />Salvar</u);
});

void it("offers seven named decimal controls with format hints and no spin buttons or autofill", () => {
  const markup = render();
  const inputs = markup.match(/<input\b[^>]*>/gu) ?? [];
  assert.deepEqual(
    inputs.map((tag) => /name="([^"]+)"/u.exec(tag)?.[1]),
    [
      "tuitionCeilingCents",
      "maximumDiscountPct",
      "punctualityDiscountPct",
      "interestRatePctDaily",
      "interestRatePctMonthly",
      "cancellationFeePct",
      "materialPriceCents",
    ],
  );
  for (const input of inputs) {
    assert.match(input, /type="text"/u);
    assert.match(input, /inputMode="decimal"/u);
    assert.match(input, /placeholder="Ex\.: [^"]+"/u);
    assert.match(input, /autoComplete="off"/u);
    assert.match(input, /aria-required="true"/u);
  }
  assert.equal((markup.match(/<form\b/gu) ?? []).length, 1);
  assert.match(markup, /<button[^>]*type="submit"/u);
  assert.match(inputs[0] ?? "", /autofocus=""/u);
});

void it("prevents edits during save so the response cannot discard later typing", () => {
  const markup = render(true);
  const inputs = markup.match(/<input\b[^>]*>/gu) ?? [];
  assert.equal(inputs.length, FIELD_COUNT);
  for (const input of inputs) assert.match(input, /disabled=""/u);
  assert.match(markup, /Salvando…/u);
});
