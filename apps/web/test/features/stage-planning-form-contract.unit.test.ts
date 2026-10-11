import assert from "node:assert/strict";
import { it } from "node:test";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WindowFields, ItemFields } from "../../src/features/stage-planning/form-fields.js";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
void it("presents the plan window as labelled numeric date fields and requires an attributed revision reason", () => {
  const markup = renderToStaticMarkup(
    createElement(WindowFields, {
      values: { plannedStartOn: "", plannedEndOn: "", objective: "", reason: "" },
      editing: true,
      errors: {
        plannedEndOn: "Informe o prazo do estágio.",
        reason: "Explique o motivo da revisão.",
      },
      change: () => {},
    }),
  );
  for (const name of ["plannedStartOn", "plannedEndOn"]) {
    const input = markup.match(new RegExp(`<input[^>]*name="${name}"[^>]*>`, "u"))?.[0] ?? "";
    assert.match(markup, new RegExp(`for="${name}"`, "u"));
    assert.match(input, /placeholder="dd\/mm\/aaaa"/u);
    assert.match(input, /inputMode="numeric"/u);
    assert.match(input, /autoComplete="off"/iu);
  }
  assert.match(markup, /Informe o prazo do estágio\./u);
  assert.match(markup, /Explique o motivo da revisão\./u);
  const reason = markup.match(/<textarea[^>]*name="reason"[^>]*>/u)?.[0] ?? "";
  assert.match(reason, /aria-invalid="true"/u);
  assert.doesNotMatch(markup, /type="date"/u);
});
void it("offers four visible activity types and exposes optional page errors without hiding the required title", () => {
  const markup = renderToStaticMarkup(
    createElement(ItemFields, {
      values: {
        plannedOn: "",
        kind: "REVIEW",
        title: "",
        reference: "",
        pageFrom: "20",
        pageTo: "19",
        reason: "",
      },
      editing: false,
      errors: {
        title: "Descreva a atividade planejada.",
        pageTo: "Informe um intervalo de páginas válido.",
      },
      change: () => {},
    }),
  );
  for (const label of ["Conteúdo", "Revisão", "Avaliação", "Atividade"])
    assert.match(markup, new RegExp(`>${label}</button>`, "u"));
  assert.match(markup, /<details[^>]*open=""/u);
  assert.match(markup, /Informe um intervalo de páginas válido\./u);
  assert.match(markup, /Descreva a atividade planejada\./u);
  const title = markup.match(/<input[^>]*name="title"[^>]*>/u)?.[0] ?? "";
  assert.match(title, /aria-invalid="true"/u);
  assert.doesNotMatch(markup, /name="reason"/u);
});
