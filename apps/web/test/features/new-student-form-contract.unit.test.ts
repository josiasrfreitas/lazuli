/**
 * Form contract of the "Novo aluno" step Dados — the rules from
 * docs/frontend/forms.md that a design review found missing once. Rendering
 * to static markup is enough: every rule is an attribute, an element, or a
 * count, so no DOM is needed.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  DadosStep,
  type DadosStepProps,
} from "../../src/features/students/new-student/dados-step.js";
import { initialNewStudentState } from "../../src/features/students/new-student/reducer.js";

// The components compile to classic JSX under the test runner.
(globalThis as typeof globalThis & { React: typeof React }).React = React;

const INPUT_TAG = /<input\b[^>]*>/g;
const FORM_TAG = /<form\b[^>]*>/g;

function render(overrides: Partial<DadosStepProps> = {}): string {
  return renderToStaticMarkup(
    createElement(DadosStep, {
      errors: {},
      fields: initialNewStudentState.fields,
      minor: false,
      onFieldChange: () => {},
      onSubmit: () => {},
      ...overrides,
    }),
  );
}

function attribute(tag: string, name: string): string | null {
  // Static markup keeps React's camelCase for attributes such as `autoComplete`.
  const match = new RegExp(`\\s${name}="([^"]*)"`, "i").exec(tag);

  return match === null ? null : (match[1] ?? "");
}

void describe("new-student form contract", () => {
  const markup = render();
  const inputs = markup.match(INPUT_TAG) ?? [];

  void it("renders every wizard text control", () => {
    const names = inputs.map((tag) => attribute(tag, "name"));

    assert.deepEqual(names, [
      "fullName",
      "birthDate",
      "documentNumber",
      "phone",
      "email",
      "guardianName",
      "guardianDocumentNumber",
      "guardianPhone",
      "guardianEmail",
    ]);
  });

  void it("gives every control a placeholder and keeps browser autofill out", () => {
    for (const tag of inputs) {
      assert.notEqual(attribute(tag, "placeholder"), null, tag);
      assert.notEqual(attribute(tag, "placeholder"), "", tag);
      assert.equal(attribute(tag, "autocomplete"), "off", tag);
    }
  });

  void it("offers the native calendar for the birth date without a document selector", () => {
    const birthDate = inputs.find((tag) => attribute(tag, "name") === "birthDate") ?? "";
    assert.equal(attribute(birthDate, "type"), "date");
    assert.doesNotMatch(markup, /role="radiogroup"|CPF<\/button>|RG<\/button>/u);
  });

  void it("is a real form, so Enter submits from any field", () => {
    assert.equal((markup.match(FORM_TAG) ?? []).length, 1);
  });

  void it("uses one document field without a type selector", () => {
    assert.equal(markup.includes('role="combobox"'), false);
    assert.equal(markup.includes("<select"), false);
    assert.equal(markup.includes('data-slot="segmented-control"'), false);
    const studentDocument = inputs.find((tag) => attribute(tag, "name") === "documentNumber") ?? "";
    assert.equal(attribute(studentDocument, "aria-required"), "true");
    assert.equal(
      inputs.filter(
        (tag) =>
          attribute(tag, "name")?.includes("documentNumber") ||
          attribute(tag, "name") === "guardianDocumentNumber",
      ).length,
      2,
    );
  });

  void it("keeps guardian fields visible with an optional badge for adults", () => {
    assert.match(markup, /name="guardianName"/u);
    assert.match(markup, /data-slot="badge"[^>]*>Opcional<\/span>/u);
    assert.doesNotMatch(markup, /Adicionar responsável|Remover responsável/u);
  });

  void it("marks the guardian as required for minors", () => {
    const minor = render({ minor: true });
    assert.match(minor, /data-slot="badge"[^>]*>Obrigatório<\/span>/u);
    assert.match(minor, /aria-required="true"[^>]*name="guardianName"/u);
  });
});
