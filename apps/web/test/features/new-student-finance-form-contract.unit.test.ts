import assert from "node:assert/strict";
import { it } from "node:test";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, trpc } from "../../src/lib/trpc.js";
import { emptyContractFields } from "../../src/features/contracts/contract-form-model.js";
import {
  FinanceStep,
  FINANCE_FORM_ID,
  type FinanceStepProps,
} from "../../src/features/students/new-student/finance-step.js";
import { initialNewStudentState } from "../../src/features/students/new-student/reducer.js";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const STUDENT = {
  ...initialNewStudentState.fields,
  fullName: "Ana Souza",
  guardianName: "Maria Souza",
};

function render(
  overrides: Partial<FinanceStepProps["completion"]> = {},
  student = STUDENT,
): string {
  const client = createTRPCClient();
  const queryClient = new QueryClient();
  const form = createElement(FinanceStep, {
    student,
    completion: {
      state: {
        fields: emptyContractFields,
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
  });
  return renderToStaticMarkup(
    createElement(trpc.Provider, {
      client,
      queryClient,
      children: createElement(QueryClientProvider, { client: queryClient }, form),
    }),
  );
}

void it("submits a real named form with calendar controls", () => {
  const markup = render();
  assert.equal((markup.match(/<form\b/gu) ?? []).length, 1);
  assert.match(markup, new RegExp(`id="${FINANCE_FORM_ID}"`));
  assert.match(markup, /noValidate|novalidate/u);
  const inputs = (markup.match(/<input\b[^>]*>/gu) ?? []).filter((tag) =>
    /data-slot="input"/u.test(tag),
  );
  assert.deepEqual(
    inputs.map((tag) => /name="([^"]+)"/u.exec(tag)?.[1]),
    ["payerSearch", "agreedOn", "firstDueDate", "endsOn", "monthlyAmount"],
  );
  for (const tag of inputs) {
    assert.match(tag, /placeholder="[^"]+"/u);
    assert.match(tag, /autoComplete="off"|autocomplete="off"/u);
  }
  for (const name of ["agreedOn", "firstDueDate", "endsOn"]) {
    const tag = inputs.find((input) => input.includes(`name="${name}"`)) ?? "";
    assert.match(tag, /type="date"/u);
    assert.match(tag, /placeholder="dd\/mm\/aaaa"/u);
  }
});

void it("uses the existing name search with one guardian copy action and no extra payer choices", () => {
  const markup = render();
  assert.match(markup, /name="payerSearch"/u);
  assert.match(markup, /role="combobox"/u);
  assert.match(markup, /aria-label="Copiar responsável para pagador"/u);
  assert.doesNotMatch(markup, /Copiar aluno para pagador|Novo pagador|Já cadastrado/u);
  assert.doesNotMatch(markup, /name="payerPhone"|name="payerEmail"|name="payerDocumentNumber"/u);
  const adult = render({}, { ...initialNewStudentState.fields, fullName: "Ana Souza" });
  assert.match(adult, /aria-label="Copiar aluno para pagador"/u);
  assert.doesNotMatch(adult, /Copiar responsável para pagador/u);
});

void it("shows only the selected payer tag and hides its editable details and copy action", () => {
  const markup = render({
    state: {
      fields: {
        ...emptyContractFields,
        payerId: "00000000-0000-4000-8000-000000000011",
        payerLabel: "Maria Souza",
      },
      errors: {},
      change: () => {},
      submissionError: "",
    },
  });
  assert.match(markup, /Remover Maria Souza/u);
  assert.doesNotMatch(
    markup,
    /name="payerSearch"|name="payerPhone"|name="payerEmail"|name="payerDocumentNumber"/u,
  );
  assert.doesNotMatch(markup, /Copiar responsável para pagador|Copiar aluno para pagador/u);
});

void it("reveals document and contact fields only while creating a payer with the existing pattern", () => {
  const markup = render({
    state: {
      fields: { ...emptyContractFields, payerMode: "create", payerName: "Maria Souza" },
      errors: {},
      change: () => {},
      submissionError: "",
    },
  });
  for (const name of ["payerSearch", "payerDocumentNumber", "payerPhone", "payerEmail"])
    assert.match(markup, new RegExp(`name="${name}"`));
  assert.match(markup, /aria-label="Copiar responsável para pagador"/u);
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
