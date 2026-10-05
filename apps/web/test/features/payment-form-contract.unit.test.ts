import assert from "node:assert/strict";
import { it } from "node:test";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, trpc } from "../../src/lib/trpc.js";
import { PaymentPicker } from "../../src/features/installments/payment/payment-picker.js";
import { PaymentForm } from "../../src/features/installments/payment/payment-dialog.js";
import type { PaymentFormState } from "../../src/features/installments/payment/logic.js";
import { PAYMENT_DRAFT, PAYMENT_PREVIEW } from "../support/payment-draft.js";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
const state: PaymentFormState = {
  draft: PAYMENT_DRAFT,
  preview: PAYMENT_PREVIEW,
  dispatch: () => {},
  loading: false,
  error: null,
  submitting: false,
  uncertain: false,
  revision: 0,
  submit: () => {},
  refresh: () => {},
  isSubmitting: () => false,
};
void it("renders one real form with masked date and compact named payment controls", () => {
  const html = renderToStaticMarkup(createElement(PaymentForm, { state, children: null }));
  assert.equal((html.match(/<form\b/g) ?? []).length, 1);
  assert.match(html, /id="register-payments"/);
  assert.match(html, /noValidate=""/i);
  assert.doesNotMatch(html, /type="date"/);
  const inputs = (html.match(/<input\b[^>]*>/g) ?? []).filter(
    (tag) => !tag.includes('type="hidden"') && !tag.includes('aria-hidden="true"'),
  );
  assert.equal(inputs.length, 2);
  for (const input of inputs) {
    assert.match(input, /name="[^"]+"/);
    assert.match(input, /placeholder="[^"]+"/);
    assert.match(input, /autoComplete="off"/i);
    assert.match(input, /data-size="sm"/);
  }
  assert.match(html, /Saldo/);
  assert.doesNotMatch(html, /Recebimentos · confira os totais|name="total-/);
  assert.match(html, /desconto por pontualidade/u);
  assert.doesNotMatch(html, /\+ R\$[^<]*juros/);
  assert.doesNotMatch(html, /Continuar|Stepper|Pagamento registrado/);
});
void it("shows preview failure without claiming settlement or successful registration", () => {
  const preview = [
    {
      installmentId: PAYMENT_DRAFT.items[0]!.row.installmentId,
      line: null,
      error: "Parcela alterada",
    },
  ];
  const html = renderToStaticMarkup(
    createElement(PaymentForm, {
      state: { ...state, preview, error: "Falha na prévia" },
      children: null,
    }),
  );
  assert.match(html, /Prévia indisponível/);
  assert.match(html, /Parcela alterada/);
  assert.doesNotMatch(html, /Quitação integral|Pagamento registrado/);
});

void it("opens the main entry with an accessible search field inside the payment form", () => {
  const empty = { ...state, draft: { ...state.draft, items: [] }, preview: [] };
  const queryClient = new QueryClient();
  const form = createElement(PaymentForm, {
    state: empty,
    children: createElement(PaymentPicker, { state: empty }),
  });
  const html = renderToStaticMarkup(
    createElement(trpc.Provider, {
      client: createTRPCClient(),
      queryClient,
      children: createElement(QueryClientProvider, { client: queryClient }, form),
    }),
  );
  const searchId = html.match(/<input id="([^"]+)"[^>]*name="search"/)?.[1];
  assert.ok(searchId);
  assert.ok(html.includes(`for="${searchId}"`));
  assert.match(html, />Buscar por pagador ou aluno<\/label>/);
  assert.match(html, /Busque e adicione os recebíveis para registrar/);
  assert.equal((html.match(/<form\b/g) ?? []).length, 1);
  queryClient.clear();
});

void it("names each receipt by payer and keeps its allocated installments together", () => {
  const first = PAYMENT_DRAFT.items[0]!;
  const draft = {
    ...PAYMENT_DRAFT,
    items: [
      { ...first, amount: 10000 },
      {
        ...first,
        row: { ...first.row, installmentId: "second-installment", sequenceNumber: 2 },
        amount: 5000,
      },
      {
        ...first,
        receiptId: "separate-receipt",
        row: {
          ...first.row,
          installmentId: "third-installment",
          payer: { id: "other-payer", name: "Outro pagador" },
        },
        amount: 7000,
      },
    ],
  };
  const html = renderToStaticMarkup(
    createElement(PaymentForm, { state: { ...state, draft }, children: null }),
  );
  const sections = html.match(/<section\b[\s\S]*?<\/section>/g) ?? [];
  assert.equal(sections.length, 2);
  assert.match(sections[0], /Pagador homônimo/);
  assert.match(sections[0], /2 parcelas · 1 recebimento/);
  assert.match(sections[0], /R\$\u00A0150,00/);
  assert.match(sections[0], /name="received-second-installment"/);
  assert.doesNotMatch(sections[0], /Outro pagador|received-third-installment/);
  assert.match(sections[1]!, /Outro pagador/);
  assert.match(sections[1]!, /R\$\u00A070,00/);
  assert.match(sections[1]!, /name="received-third-installment"/);
});

void it("does not describe an invalid received amount as a full settlement", () => {
  for (const amount of [0, null, 30000]) {
    const draft = { ...PAYMENT_DRAFT, items: [{ ...PAYMENT_DRAFT.items[0]!, amount }] };
    const html = renderToStaticMarkup(
      createElement(PaymentForm, { state: { ...state, draft }, children: null }),
    );
    assert.match(html, /aria-invalid="true"/);
    assert.match(html, /Informe um valor positivo até a quitação/);
    assert.doesNotMatch(html, /Quitação integral/);
  }
});
