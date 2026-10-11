import assert from "node:assert/strict";
import { it } from "node:test";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NarrativeField } from "../../src/features/shared/task-form.js";
import {
  InterventionFields,
  MotivatingOccurrenceFields,
} from "../../src/features/pedagogical-follow-up/intervention-form.js";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
void it("keeps the intervention deadline as one masked text field and displays its validation message", () => {
  const markup = renderToStaticMarkup(
    createElement(InterventionFields, {
      values: { title: "", teacherId: "", objective: "", nextStep: "", dueOn: "" },
      errors: { dueOn: "Informe uma data válida." },
      teachers: [],
      change: () => {},
    }),
  );
  const deadline = markup.match(/<input[^>]*name="dueOn"[^>]*>/u)?.[0] ?? "";
  assert.match(deadline, /placeholder="dd\/mm\/aaaa"/u);
  assert.match(deadline, /inputMode="numeric"/u);
  assert.match(deadline, /autoComplete="off"/iu);
  assert.match(deadline, /aria-invalid="true"/u);
  assert.match(markup, /Informe uma data válida\./u);
  assert.doesNotMatch(markup, /type="date"/u);
  for (const name of ["intervention-title", "nextStep", "objective"]) {
    assert.match(markup, new RegExp(`name="${name}"`, "u"));
  }
});
void it("labels occurrence accounts, addenda and intervention outcomes with accessible multiline errors", () => {
  for (const [name, label] of [
    ["account", "O que aconteceu?"],
    ["note-body", "Contexto ou correção"],
    ["follow-up-body", "Resultado da intervenção"],
  ]) {
    const markup = renderToStaticMarkup(
      createElement(NarrativeField, {
        name: name!,
        label: label!,
        value: "",
        placeholder: "Descreva o contexto observado.",
        error: "Descreva o contexto com mais detalhes.",
        onChange: () => {},
      }),
    );
    assert.match(markup, new RegExp(`for="${name}"`, "u"));
    assert.match(markup, new RegExp(`<textarea[^>]*name="${name}"`, "u"));
    assert.match(markup, /autoComplete="off"/iu);
    assert.match(markup, /aria-invalid="true"/u);
    assert.match(markup, /Descreva o contexto com mais detalhes\./u);
    assert.match(markup, /placeholder="Descreva o contexto observado\."/u);
  }
});

void it("renders the motivating-report validation inside its field without losing the instruction", () => {
  const markup = renderToStaticMarkup(
    createElement(MotivatingOccurrenceFields, {
      rows: [],
      ids: [],
      error: "Selecione pelo menos duas ocorrências.",
      onChange: () => {},
    }),
  );
  assert.match(markup, /Selecione pelo menos duas ocorrências\./u);
  assert.match(markup, /Eles continuam disponíveis no histórico do aluno\./u);
  assert.match(markup, /data-slot="field-error"/u);
});
