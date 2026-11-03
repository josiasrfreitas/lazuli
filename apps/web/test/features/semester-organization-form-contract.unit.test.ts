import assert from "node:assert/strict";
import { it } from "node:test";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SlotFields } from "../../src/features/class-organization/slot-fields.js";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

void it("gives every planned-class interval distinct labelled, masked time controls", () => {
  const markup = renderToStaticMarkup(
    createElement(SlotFields, {
      slots: [
        { weekday: "MONDAY", startTime: "14:00", endTime: "15:00" },
        { weekday: "WEDNESDAY", startTime: "", endTime: "" },
      ],
      onChange: () => {},
    }),
  );
  for (const name of ["slot-start-0", "slot-end-0", "slot-start-1", "slot-end-1"]) {
    const control = markup.match(new RegExp(`<input[^>]*name="${name}"[^>]*>`, "u"))?.[0] ?? "";
    assert.match(control, /inputMode="numeric"/u);
    assert.match(control, /autoComplete="off"/iu);
    assert.match(control, /placeholder="\d{2}:\d{2}"/u);
    assert.match(markup, new RegExp(`for="${name}"`, "u"));
  }
  assert.doesNotMatch(markup, /type="(?:date|time)"/u);
  assert.match(markup, /aria-label="Remover horário 2"/u);
});

void it("keeps invalid weekly intervals visible and associates their explanation with the group", () => {
  const markup = renderToStaticMarkup(
    createElement(SlotFields, {
      slots: [{ weekday: "MONDAY", startTime: "15:00", endTime: "14:00" }],
      onChange: () => {},
      error: "O fim deve ser posterior ao início.",
    }),
  );
  const describedBy =
    markup.match(/<fieldset[^>]*aria-invalid="true"[^>]*aria-describedby="([^"]+)"/u)?.[1] ?? "";
  assert.notEqual(describedBy, "");
  assert.ok(markup.includes(`id="${describedBy}" role="alert"`));
  assert.match(markup, /O fim deve ser posterior ao início\./u);
  const remove = markup.match(/<button[^>]*aria-label="Remover horário 1"[^>]*>/u)?.[0] ?? "";
  assert.match(remove, /\sdisabled(?:=""|\s|>)/u);
});
