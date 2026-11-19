import assert from "node:assert/strict";
import { it } from "node:test";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useValidation } from "../../src/features/shared/task-form.js";
import { CaseEntryForm } from "../../src/features/class-organization/case-form.js";

function fields(mode: "teacher" | "intervention" | "signal"): string {
  function Form(): ReactElement {
    return createElement(CaseEntryForm, {
      mode,
      id: "placement",
      semesterId: "semester",
      pending: false,
      validation: useValidation(),
      onSave: () => {},
    });
  }
  return renderToStaticMarkup(createElement(Form));
}

void it("asks separately about a verbal report and the teacher's observations", () => {
  const html = fields("teacher");
  assert.equal(html.match(/<form\b/gu)?.length, 1);
  assert.match(html, /aria-labelledby="verbalReport-label"/u);
  assert.match(html, /O aluno ou a família falou em sair\?/u);
  assert.match(html, /<label[^>]*for="narrative"/u);
  assert.match(
    html,
    /<textarea\b(?=[^>]*name="narrative")(?=[^>]*autoComplete="off")(?=[^>]*placeholder="Ex\.: deixou de participar)[^>]*>/iu,
  );
  assert.doesNotMatch(html, /aria-pressed="true"|Financeiro/u);
});

void it("opens an intervention on contact and provides a separate result field", () => {
  const html = fields("intervention");
  assert.match(html, /Com quem e como foi a tentativa\?/u);
  assert.match(html, /<label[^>]*for="outcome"/u);
  assert.match(
    html,
    /<textarea\b(?=[^>]*name="outcome")(?=[^>]*autoComplete="off")(?=[^>]*placeholder="Ex\.: ligação sem resposta)[^>]*>/iu,
  );
});

void it("uses a dropdown for the record type and a separate reason for exit risk", () => {
  const html = fields("signal");
  assert.match(html, /Risco de saída/u);
  assert.match(html, /id="case-kind"/u);
  assert.match(html, /Motivo do risco de saída/u);
  assert.doesNotMatch(html, /Salvar e escolher turma|Impedimento na turma/u);
  assert.match(fields("intervention"), /Contato/u);
});
