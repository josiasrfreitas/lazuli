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
  assert.equal(inputs.length, 3);
  for (const input of inputs) {
    assert.match(input, /name="[^"]+"/);
    assert.match(input, /placeholder="[^"]+"/);
    assert.match(input, /autoComplete="off"/i);
    assert.match(input, /data-size="sm"/);
  }
  assert.match(html, /Saldo registrado/);
  assert.match(html, /Recebimentos · confira os totais/);
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
