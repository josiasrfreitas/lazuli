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
      guardianOpen: true,
      minor: false,
      onFieldChange: () => {},
      onGuardianToggle: () => {},
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

  void it("uses masked text for dates so one Tab crosses the field", () => {
    assert.equal(
      inputs.some((tag) => attribute(tag, "type") === "date"),
      false,
    );
  });

  void it("is a real form, so Enter submits from any field", () => {
    assert.equal((markup.match(FORM_TAG) ?? []).length, 1);
  });

  void it("offers the two document types inline instead of behind a dropdown", () => {
    assert.equal(markup.includes('role="combobox"'), false);
    assert.equal(markup.includes("<select"), false);
    assert.ok(markup.includes('data-slot="segmented-control"'));
  });

  void it("hides the guardian fields for adults until asked", () => {
    const collapsed = render({ guardianOpen: false });

    assert.equal(collapsed.includes('name="guardianName"'), false);
    assert.ok(collapsed.includes("Adicionar responsável"));
  });
});
