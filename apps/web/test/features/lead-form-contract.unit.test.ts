import assert from "node:assert/strict";
import { it } from "node:test";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CaptureFields } from "../../src/features/admissions/lead-capture-dialog.js";
import { ContactFields } from "../../src/features/admissions/lead-contact-dialog.js";

(globalThis as typeof globalThis & { React: typeof React }).React = React;
void it("quick capture exposes contact-only fields with format hints and field errors", () => {
  const markup = renderToStaticMarkup(
    createElement(CaptureFields, {
      draft: { fullName: "", phone: "", email: "", contactName: "", source: "" },
      errors: { phone: "Informe telefone ou e-mail para contato." },
      onChange: () => {},
    }),
  );
  const inputs = markup.match(/<input\b[^>]*>/gu) ?? [];
  assert.equal(inputs.length, 5);
  for (const input of inputs) {
    assert.match(input, /name="lead-/u);
    assert.match(input, /placeholder="[^"]+"/u);
    assert.match(input, /autoComplete="off"/iu);
  }
  assert.match(markup, /aria-invalid="true"/u);
  assert.match(markup, /Informe telefone ou e-mail para contato\./u);
  assert.doesNotMatch(markup, /Disponibilidade|Modalidade|type="date"/u);
});
void it("contact history uses a single masked date field and an accessible multiline summary", () => {
  const markup = renderToStaticMarkup(
    createElement(ContactFields, {
      date: "",
      summary: "",
      errors: { summary: "Registre o que foi conversado." },
      onDate: () => {},
      onSummary: () => {},
    }),
  );
  assert.match(markup, /name="lead-contact-date"/u);
  assert.match(markup, /placeholder="dd\/mm\/aaaa"/u);
  assert.match(markup, /<textarea[^>]*name="lead-contact-summary"[^>]*aria-invalid="true"/u);
  assert.match(markup, /Registre o que foi conversado\./u);
  assert.doesNotMatch(markup, /type="date"/u);
});
