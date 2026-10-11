import assert from "node:assert/strict";
import { it } from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QrWindowForm } from "../../src/features/student-attendance/qr-fields.js";
import {
  StudentNameField,
  StudentNameChoices,
} from "../../src/features/student-attendance/student-fields.js";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
void it("offers a named non-autofilling input with adjacent validation and a full-name hint", () => {
  const markup = renderToStaticMarkup(
    React.createElement(StudentNameField, {
      name: "Ana",
      change: () => {},
      error: "Digite seu nome completo",
      disabled: false,
    }),
  );
  assert.match(markup, /name="studentName"/u);
  assert.match(markup, /autoComplete="off"|autocomplete="off"/u);
  assert.match(markup, /placeholder="Ex.: Ana Beatriz Martins"/u);
  assert.match(markup, /aria-invalid="true"/u);
  assert.match(markup, /Digite seu nome completo/u);
});
void it("keeps indistinguishable homonyms disabled with a manual recording explanation", () => {
  const markup = renderToStaticMarkup(
    React.createElement(StudentNameChoices, {
      selected: "",
      select: () => {},
      disabled: false,
      matches: {
        refine: false,
        exactId: null,
        options: [{ id: "a", name: "Ana Silva", phoneHint: null, manualRequired: true }],
      },
    }),
  );
  assert.match(markup, /disabled=""/u);
  assert.match(markup, /Há cadastros iguais/u);
  assert.match(markup, /professor para identificar/u);
  assert.doesNotMatch(markup, /aria-pressed="true"/u);
});

void it("uses an explicit form with three named validity choices and explains link replacement", () => {
  const markup = renderToStaticMarkup(
    React.createElement(QrWindowForm, {
      minutes: 10,
      change: () => {},
      active: true,
      format: "ONLINE",
      submit: () => {},
    }),
  );
  assert.match(markup, /<form[^>]*id="open-attendance-link"[^>]*noValidate=""/u);
  assert.match(markup, /aria-label="Validade do link"/u);
  assert.match(markup, /10 min/u);
  assert.match(markup, /20 min/u);
  assert.match(markup, /30 min/u);
  assert.match(markup, /encerra o anterior e preserva os envios/u);
  assert.doesNotMatch(markup, /sua localização será/u);
});
