import assert from "node:assert/strict";
import { it } from "node:test";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyContractFields } from "../../src/features/contracts/contract-form-model.js";
import {
  FinanceStep,
  FINANCE_FORM_ID,
  type FinanceStepProps,
} from "../../src/features/students/new-student/finance-step.js";
import { initialNewStudentState } from "../../src/features/students/new-student/reducer.js";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

function render(overrides: Partial<FinanceStepProps["completion"]> = {}): string {
  return renderToStaticMarkup(
    createElement(FinanceStep, {
      student: {
        ...initialNewStudentState.fields,
        fullName: "Ana Souza",
        guardianName: "Maria Souza",
      },
      completion: {
        state: {
          fields: { ...emptyContractFields, payerMode: "create" },
          errors: {},
          change: () => {},
          submissionError: "",
        },
        offer: { data: null, isPending: false, isError: false, refetch: () => {} },
        preview: null,
        pending: false,
        finish: () => {},
        ...overrides,
      },
    }),
  );
}

void it("submits a real named form with compact masked date controls and format hints", () => {
  const markup = render();
  assert.equal((markup.match(/<form\b/gu) ?? []).length, 1);
  assert.match(markup, new RegExp(`id="${FINANCE_FORM_ID}"`));
  assert.match(markup, /noValidate|novalidate/u);
  const inputs = markup.match(/<input\b[^>]*>/gu) ?? [];
  assert.deepEqual(
    inputs.map((tag) => /name="([^"]+)"/u.exec(tag)?.[1]),
    ["payerName", "payerDocumentNumber", "agreedOn", "firstDueDate", "endsOn", "monthlyAmount"],
  );
  for (const tag of inputs) {
    assert.match(tag, /placeholder="[^"]+"/u);
    assert.match(tag, /autoComplete="off"|autocomplete="off"/u);
  }
  for (const name of ["agreedOn", "firstDueDate", "endsOn"]) {
    const tag = inputs.find((input) => input.includes(`name="${name}"`)) ?? "";
    assert.match(tag, /type="text"/u);
    assert.match(tag, /inputMode="numeric"|inputmode="numeric"/u);
    assert.match(tag, /placeholder="dd\/mm\/aaaa"/u);
  }
});

void it("offers explicit copy actions and groups the financial decisions without exposing blank contacts", () => {
  const markup = render();
  for (const label of [
    "Pagador",
    "Copiar aluno",
    "Copiar responsável",
    "Novo pagador",
    "Já cadastrado",
    "Condições do contrato",
    "Plano de pagamento",
  ])
    assert.match(markup, new RegExp(label));
  assert.doesNotMatch(markup, /name="payerPhone"|name="payerEmail"/u);
  assert.doesNotMatch(markup, /role="combobox"|<select/u);
});

void it("disables financial editing while completion is pending and exposes its failure", () => {
  const markup = render({
    pending: true,
    state: {
      fields: { ...emptyContractFields, payerMode: "create" },
      errors: { payerName: "Campo obrigatório." },
      change: () => {},
      submissionError: "Falha na criação.",
    },
  });
  assert.match(markup, /<fieldset[^>]*disabled/u);
  assert.match(markup, /aria-invalid="true"/u);
  assert.match(markup, /Campo obrigatório\./u);
  assert.match(markup, /role="alert"[^>]*>Falha na criação\./u);
});

void it("keeps the advanced quantity named and shows its format hint", () => {
  const markup = render({
    state: {
      fields: { ...emptyContractFields, payerMode: "create", paymentPlan: "special" },
      errors: {},
      change: () => {},
      submissionError: "",
    },
  });
  const quantity =
    (markup.match(/<input\b[^>]*>/gu) ?? []).find((tag) =>
      tag.includes('name="installmentCount"'),
    ) ?? "";
  assert.match(quantity, /placeholder="Ex\.: 3"/u);
  assert.match(quantity, /autoComplete="off"|autocomplete="off"/u);
  assert.match(quantity, /inputMode="numeric"|inputmode="numeric"/u);
});
