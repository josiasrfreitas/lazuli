import assert from "node:assert/strict";
import { it } from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  LeadCaptureContactFields,
  LeadCaptureNotesField,
  type Draft,
} from "../../src/features/admissions/lead-capture-fields.js";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
const draft: Draft = {
  fullName: "",
  phone: "",
  email: "",
  contactName: "",
  source: "",
  notes: "",
  contactRole: "STUDENT",
  contactOwner: "STUDENT",
  birthDate: "",
  englishExperience: "SOME",
  stageId: null,
  interest: "UNKNOWN",
  format: null,
  scheduleType: null,
};
void it("labels contact ownership and masked birth date while exposing invalid lead contacts", () => {
  verifyContactFields("STUDENT");
  verifyContactFields("GUARDIAN");
});

function verifyContactFields(contactRole: "STUDENT" | "GUARDIAN"): void {
  const markup = renderToStaticMarkup(
    React.createElement(LeadCaptureContactFields, {
      draft: { ...draft, contactRole, contactOwner: contactRole },
      errors: { phone: "Informe telefone ou e-mail para contato." },
      change: () => {},
    }),
  );
  for (const name of [
    "lead-name",
    "phone",
    "email",
    "birthDate",
    "source",
    ...(contactRole === "GUARDIAN" ? ["contactName"] : []),
  ]) {
    const input = markup.match(new RegExp(`<input[^>]*name="${name}"[^>]*>`))?.[0] ?? "";
    assert.match(input, /placeholder="[^"]+"/u);
    assert.match(input, /autoComplete="off"/iu);
  }
  assert.match(markup.match(/<input[^>]*name="phone"[^>]*>/u)?.[0] ?? "", /aria-invalid="true"/u);
  assert.match(markup, /Informe telefone ou e-mail para contato\./u);
  assert.match(
    markup.match(/<input[^>]*name="birthDate"[^>]*>/u)?.[0] ?? "",
    /inputMode="numeric"/u,
  );
  assert.match(markup, /placeholder="dd\/mm\/aaaa"/u);
  assert.doesNotMatch(markup, /type="date"|Documento|Contrato/u);
  if (contactRole === "GUARDIAN") assert.match(markup, /De quem é o contato abaixo/u);
}
void it("keeps current lead notes multiline with accessible localized errors", () => {
  const markup = renderToStaticMarkup(
    React.createElement(LeadCaptureNotesField, {
      value: "",
      onChange: () => {},
      error: "Confira as observações.",
    }),
  );
  assert.match(markup, /for="lead-notes"/u);
  assert.match(markup, /<textarea[^>]*name="notes"[^>]*aria-invalid="true"/u);
  assert.match(markup, /autoComplete="off"/iu);
  assert.match(markup, /Confira as observações\./u);
});
