import assert from "node:assert/strict";
import { it } from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AttendanceSettingsForm } from "../../src/features/student-attendance/settings-fields.js";
import { renderWithQueries } from "../support/query-render.js";
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
  assert.match(markup, /<form[^>]*id="open-attendance-link"[^>]*noValidate=""/iu);
  assert.match(markup, /aria-label="Validade do link"/u);
  assert.match(markup, /10 min/u);
  assert.match(markup, /20 min/u);
  assert.match(markup, /30 min/u);
  assert.match(markup, /encerra o anterior e preserva os envios/u);
  assert.doesNotMatch(markup, /sua localização será/u);
});

void it("supports address search and a map with a 200m radius and explicit GPS criteria", () => {
  const markup = renderWithQueries(
    React.createElement(AttendanceSettingsForm, {
      model: {
        fields: { addressLabel: "", latitude: "", longitude: "", radiusMeters: "200", maxAccuracyMeters: "" },
        formRef: {current:null},
        errors: {},
        submit: () => {},
        change: () => {},
        setPoint: () => {},
        clearPoint: () => {},
        mapFocusVersion: 0,
        reset: () => {},
        point: null,
        dirty: true,
        locating: false,
        locationError: "",
        locate: async () => {},
        save: { isPending: false, isSuccess: false, error: null },
      },
    }),
  );
  assert.match(markup, /<form[^>]*noValidate=""/iu);
  assert.match(markup, /placeholder="Rua, número e cidade"/u);
  assert.match(markup, /Mapa e área de presença da escola/u);
  const inputs = (markup.match(/<input\b[^>]*>/gu) ?? []).filter(tag => /name="(?:latitude|longitude|radiusMeters|maxAccuracyMeters)"/u.test(tag));
  assert.deepEqual(inputs.map(tag=>/name="([^"]+)"/u.exec(tag)?.[1]), ["radiusMeters","maxAccuracyMeters","latitude","longitude"]);
  for (const input of inputs) {
    assert.match(input, /name="radiusMeters"/u.test(input) ? /value="200"/u : /value=""/u);
    assert.match(input, /required=""/u);
    assert.match(input, /autoComplete="off"/iu);
    assert.match(input, /placeholder="Ex\.: [^"]+"/u);
  }
  assert.match(markup, /type="submit"/u);
  assert.match(markup, /Salvar localização/u);
});

void it("fixes presential validity at five minutes and explains the manual fallback", () => {
  const markup = renderToStaticMarkup(
    React.createElement(QrWindowForm, {
      minutes: 10,
      change: () => {},
      active: false,
      format: "IN_PERSON",
      submit: () => {},
    }),
  );
  assert.match(markup, /5 minutos/u);
  assert.match(markup, /permitir a localização/u);
  assert.match(markup, /chamada manual/u);
  assert.doesNotMatch(markup, /role="radiogroup"|10 min|20 min|30 min/u);
});
