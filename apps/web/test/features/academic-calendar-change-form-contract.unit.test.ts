import assert from "node:assert/strict";
import { it } from "node:test";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CalendarChangeFields,
  draftSchema,
} from "../../src/features/academic-calendar/change-fields.js";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
const draft = {
  title: "Recesso de carnaval",
  from: "16/02/2026",
  through: "17/02/2026",
  kind: "RECESS" as const,
  description: "Sem atividades acadêmicas",
};
void it("renders semester and interruption dates with labels, numeric masks and associated errors", () => {
  for (const mode of ["period", "interruption"] as const) {
    const html = renderToStaticMarkup(
      createElement(CalendarChangeFields, {
        mode,
        draft,
        errors: { through: "Revise a data final." },
        pending: false,
        update: () => {},
        submit: (event) => event.preventDefault(),
      }),
    );
    assert.match(html, /<form[^>]*id="calendar-change"/u);
    for (const name of ["from", "through"]) {
      const input = html.match(new RegExp(`<input[^>]*name="${name}"[^>]*>`))?.[0] ?? "";
      assert.match(input, /inputMode="numeric"/u);
      assert.match(input, /maxLength="10"/u);
      assert.match(input, /placeholder="dd\/mm\/aaaa"/u);
      assert.match(html, new RegExp(`for="calendar-${name}"`));
    }
    assert.match(html, /aria-describedby="calendar-through-error"/u);
    assert.match(html, /id="calendar-through-error"/u);
    assert.doesNotMatch(html, /type="date"/u);
    if (mode === "interruption") {
      assert.match(html, /aria-label="Motivo do recesso"/u);
      assert.match(html, /name="description"/u);
    } else assert.doesNotMatch(html, /name="description"/u);
  }
});
void it("accepts a one-day interruption and rejects inverted or impossible dates", () => {
  assert.equal(draftSchema.safeParse({ ...draft, through: draft.from }).success, true);
  assert.equal(draftSchema.safeParse({ ...draft, through: "15/02/2026" }).success, false);
  assert.equal(draftSchema.safeParse({ ...draft, from: "31/02/2026" }).success, false);
});
