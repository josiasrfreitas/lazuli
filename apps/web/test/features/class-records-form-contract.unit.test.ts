import assert from "node:assert/strict";
import { it } from "node:test";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ContentFields } from "../../src/features/class-records/content-fields.js";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
void it("labels actual work independently from planning and exposes invalid optional pages", () => {
  const markup = renderToStaticMarkup(
    createElement(ContentFields, {
      prefix: "student",
      value: { kind: "REVIEW", account: "", reference: "", pageFrom: "", pageTo: "3" },
      change: () => {},
      clearError: () => {},
      errors: {
        "student-account": "Descreva o que foi realizado.",
        "student-pageTo": "Informe um intervalo de páginas válido.",
      },
    }),
  );
  assert.match(markup, /for="student-account"/u);
  const account = markup.match(/<textarea[^>]*name="student-account"[^>]*>/u)?.[0] ?? "";
  assert.match(account, /aria-invalid="true"/u);
  assert.match(account, /autoComplete="off"/iu);
  assert.match(markup, /Descreva o que foi realizado\./u);
  assert.match(markup, /<details[^>]*open=""/u);
  assert.match(markup, /Informe um intervalo de páginas válido\./u);
  for (const field of ["pageFrom", "pageTo"]) {
    assert.match(markup, new RegExp(`for="student-${field}"`, "u"));
    const input =
      markup.match(new RegExp(`<input[^>]*name="student-${field}"[^>]*>`, "u"))?.[0] ?? "";
    assert.match(input, /inputMode="numeric"/u);
  }
  for (const label of ["Conteúdo", "Revisão", "Avaliação", "Atividade"])
    assert.match(markup, new RegExp(`>${label}</button>`, "u"));
});
