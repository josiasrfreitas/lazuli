import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ContractFormFields } from "../../src/features/contracts/contract-form-fields.js";
import { emptyContractFields } from "../../src/features/contracts/contract-form-model.js";
import { createTRPCClient, trpc } from "../../src/lib/trpc.js";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

function render(): string {
  const client = createTRPCClient();
  const queryClient = new QueryClient();
  return renderToStaticMarkup(
    createElement(trpc.Provider, {
      client,
      queryClient,
      children: createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(
          "form",
          { noValidate: true },
          createElement(ContractFormFields, {
            fields: emptyContractFields,
            errors: {},
            offer: null,
            preview: null,
            change: () => {},
          }),
        ),
      ),
    }),
  );
}

void describe("new contract form contract", () => {
  const markup = render();
  const inputs = markup.match(/<input\b[^>]*>/gu) ?? [];
  void it("contains one form and three named sections", () => {
    assert.equal((markup.match(/<form\b/gu) ?? []).length, 1);
    assert.match(markup, /Beneficiário e pagador/u);
    assert.match(markup, /Condições do contrato/u);
    assert.match(markup, /Plano de pagamento/u);
  });
  void it("names and hints every text input without native date controls or autofill", () => {
    assert.deepEqual(
      inputs.map((tag) => /name="([^"]+)"/u.exec(tag)?.[1]),
      [
        "studentSearch",
        "payerSearch",
        "agreedOn",
        "startsOn",
        "durationMonths",
        "monthlyAmount",
        "punctualityDiscountPct",
        "firstDueDate",
      ],
    );
    for (const tag of inputs) {
      assert.match(tag, /placeholder="[^"]+"/u);
      assert.match(tag, /autoComplete="off"|autocomplete="off"/u);
      assert.doesNotMatch(tag, /type="date"/u);
    }
  });
});
