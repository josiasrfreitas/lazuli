import assert from "node:assert/strict";
import { it } from "node:test";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TreatmentForm } from "../../src/features/financial-treatments/treatment-dialog.js";
import type { TreatmentState } from "../../src/features/financial-treatments/use-treatment.js";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
const row = {
  id: "97aa1d65-3bb3-4da5-9451-2ec0694d186a",
  party: { key: "student", name: "Aluna de teste" },
  sequenceNumber: 1,
  origin: "TUITION" as const,
  dueDate: "2026-01-31",
  balanceCents: 101_000,
  chargesCents: 1000,
  suspendedUntil: null,
};
const state: TreatmentState = {
  available: {
    isPending: false,
    isError: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: async () => {},
    refetch: async () => {},
  },
  batch: false,
  rows: [row],
  chosen: [row],
  selected: [row.id],
  showAll: true,
  amounts: {},
  suspension: true,
  suspensionOnly: false,
  until: "",
  reason: "",
  errors: {},
  error: undefined,
  pending: false,
  review: undefined,
  body: { current: null },
  balance: 101_000,
  charges: 1000,
  submit: async () => {},
  toggle: () => {},
  toggleAll: () => {},
  showAllRows: () => {},
  changeAmount: () => {},
  changeSuspension: () => {},
  changeUntil: () => {},
  changeReason: () => {},
  edit: () => {},
};
void it("keeps the agreement editor one submit form with named, masked, non-autofilled controls", () => {
  const html = renderToStaticMarkup(createElement(TreatmentForm, { state }));
  assert.equal((html.match(/<form\b/g) ?? []).length, 1);
  assert.match(html, /id="financial-treatment"/);
  assert.match(html, /noValidate=""/i);
  assert.doesNotMatch(html, /type="date"|role="combobox"|<select/);
  const controls = (html.match(/<(?:input|textarea)\b[^>]*>/g) ?? []).filter(
    (tag) => !/type="(?:hidden|checkbox)"/.test(tag) && !/aria-hidden="true"/.test(tag),
  );
  assert.deepEqual(
    controls.map((tag) => /\sname="([^"]+)"/.exec(tag)?.[1]),
    [`reduction-${row.id}`, "until", "reason"],
  );
  for (const control of controls) {
    assert.match(control, /placeholder="[^"]+"/);
    assert.match(control, /autoComplete="off"/i);
  }
  assert.match(html, /placeholder="dd\/mm\/aaaa"/);
});
