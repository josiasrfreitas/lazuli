import assert from "node:assert/strict";
import { it } from "node:test";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AssessmentGradeFields } from "../../src/features/assessments/assessment-grade-fields.js";

(globalThis as typeof globalThis & { React: typeof React }).React = React;
void it("exposes one masked date and decimal score with distinct competency labels and field errors", () => {
  const markup = renderToStaticMarkup(
    createElement(AssessmentGradeFields, {
      id: "grade-entry",
      grade: { notes: "", phase: "BLOCK_ONE", competence: "ORAL", score: "", date: "", reason: "" },
      index: 0,
      errors: { "grades.0.score": "Informe uma nota entre 0 e 100." },
      onChange: () => {},
    }),
  );
  assert.equal((markup.match(/<input\b/gu) ?? []).length, 2);
  assert.match(markup, /inputMode="decimal"/u);
  assert.match(markup, /placeholder="dd\/mm\/aaaa"/u);
  assert.match(markup, /aria-label="Nota de Oral"/u);
  assert.match(markup, /aria-label="Data da avaliação de Oral"/u);
  assert.match(markup, /Informe uma nota entre 0 e 100\./u);
  assert.match(markup, /aria-invalid="true"/u);
  assert.doesNotMatch(markup, /type="date"/u);
});
void it("asks what recovery was performed when its score is filled", () => {
  const markup = renderToStaticMarkup(
    createElement(AssessmentGradeFields, {
      id: "grade-entry",
      grade: {
        notes: "",
        phase: "RECOVERY",
        competence: "WRITTEN",
        score: "60",
        date: "11/10/2026",
        reason: "",
      },
      index: 8,
      errors: { "grades.8.reason": "Descreva a recuperação realizada." },
      onChange: () => {},
    }),
  );
  assert.equal((markup.match(/<input\b/gu) ?? []).length, 3);
  assert.match(markup, /name="reason-8"/u);
  assert.match(markup, /Descreva a recuperação realizada\./u);
});
