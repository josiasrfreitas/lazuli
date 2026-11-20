import assert from "node:assert/strict";
import { it } from "node:test";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  PostponedStartField,
  RiskLimitField,
} from "../../src/features/class-organization/formation-settings.js";
import { SlotFields } from "../../src/features/class-organization/slot-fields.js";
import { PlacementDateField } from "../../src/features/class-organization/placement-date-dialog.js";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

void it("labels the proposed allocation date and associates its validation error", () => {
  const message = "Informe uma data de hoje em diante, dentro do período letivo.";
  const html = renderToStaticMarkup(
    createElement(PlacementDateField, {
      value: "15/07/2027",
      error: message,
      onChange: () => {},
    }),
  );
  const input = html.match(/<input[^>]*name="review-effective-date"[^>]*>/u)?.[0] ?? "";
  assert.match(html, /for="review-effective-date"/u);
  assert.match(input, /aria-invalid="true"/u);
  assert.match(input, /inputMode="numeric"/u);
  assert.match(input, /placeholder="dd\/mm\/aaaa"/u);
  assert.match(input, /value="15\/07\/2027"/u);
  const describedBy = input.match(/aria-describedby="([^"]+)"/u)?.[1];
  assert.ok(describedBy && html.includes(`id="${describedBy}"`));
  assert.ok(html.includes(message));
});

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

void it("labels the inclusive risk threshold and constrains it to the server's supported range", () => {
  const html = renderToStaticMarkup(
    createElement(RiskLimitField, { value: "4", onChange: () => {} }),
  );
  assert.match(html, /for="formation-limit"/u);
  const input = html.match(/<input[^>]*name="formation-limit"[^>]*>/u)?.[0] ?? "";
  for (const attr of [
    'type="number"',
    'name="formation-limit"',
    'min="1"',
    'max="50"',
    'value="4"',
    "required",
  ])
    assert.ok(input.includes(attr), attr);
});
void it("retains the proposed date in Brazilian format and exposes a rejected postponement", () => {
  const message = "Escolha uma data posterior ao início da turma.";
  const html = renderToStaticMarkup(
    createElement(PostponedStartField, { value: "15/07/2027", onChange: () => {}, error: message }),
  );
  assert.match(html, /for="formation-start"/u);
  const input = html.match(/<input[^>]*name="formation-start"[^>]*>/u)?.[0] ?? "";
  for (const attr of [
    'inputMode="numeric"',
    'placeholder="dd/mm/aaaa"',
    'value="15/07/2027"',
    'aria-invalid="true"',
  ])
    assert.ok(input.includes(attr), attr);
  assert.ok(html.includes(message));
});
