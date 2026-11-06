import assert from "node:assert/strict";
import { it } from "node:test";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, trpc } from "../../src/lib/trpc.js";
import { PaymentReversalForm } from "../../src/features/students/profile/payment-reversal-form.js";

type Props = ComponentProps<typeof PaymentReversalForm>;
const options: Props["options"] = {
  paymentEntryId: "payment",
  date: "2026-10-05",
  payerId: "payer",
  payerName: "Pagador",
  paymentMethodName: "Pix",
  originalAmountCents: 19800,
  availableAmountCents: 19800,
  unallocatedAmountCents: 0,
  allocations: [
    {
      id: "allocation",
      installmentId: "installment",
      sequenceNumber: 1,
      dueDate: "2026-10-10",
      kind: "TUITION",
      originalAmountCents: 19800,
      availableAmountCents: 19800,
    },
  ],
  reversals: [],
};
function render(overrides: Partial<Props> = {}): string {
  const queryClient = new QueryClient();
  const props: Props = {
    options,
    methods: [],
    methodsLoading: false,
    attempt: null,
    uncertain: false,
    onAttemptChange: () => {},
    onUncertainChange: () => {},
    onBusyChange: () => {},
    onSaved: async () => {},
    ...overrides,
  };
  const html = renderToStaticMarkup(
    createElement(trpc.Provider, {
      client: createTRPCClient(),
      queryClient,
      children: createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(PaymentReversalForm, props),
      ),
    }),
  );
  queryClient.clear();
  return html;
}

void it("renders a real compact form with named controls and one confirmation", () => {
  const html = render();
  assert.equal((html.match(/<form\b/g) ?? []).length, 1);
  assert.match(html, /noValidate=""/i);
  assert.match(html, /Total a reabrir/);
  assert.equal((html.match(/type="submit"/g) ?? []).length, 1);
  assert.match(html, /Registrar estorno/);
  assert.match(html, /name="refund-date"/);
  for (const tag of html.match(/<(?:input|textarea)\b[^>]*>/g) ?? []) {
    if (tag.includes('type="file"')) continue;
    assert.match(tag, /name="[^"]+"/);
    assert.match(tag, /placeholder="[^"]+"/);
    assert.match(tag, /autoComplete="off"/i);
    if (tag.startsWith("<input")) assert.match(tag, /data-size="sm"/);
  }
});

void it("restores a refund with the Brazilian date and preserves its recovery action", () => {
  const html = render({
    uncertain: true,
    attempt: {
      commandId: "command",
      paymentEntryId: "payment",
      kind: "REFUND",
      occurredOn: new Date("2026-10-06T00:00:00Z"),
      refundMethod: "PIX",
      refundReference: "reference",
      reason: null,
      allocations: [{ paymentAllocationId: "allocation", amountCents: 9900 }],
    },
  });
  assert.doesNotMatch(html, /type="date"/);
  assert.match(html, /placeholder="dd\/mm\/aaaa"/);
  assert.match(html, /value="06\/10\/2026"/);
  assert.match(html, /Recuperar a mesma operação/);
  assert.match(html, /R\$ 99,00/);
  assert.doesNotMatch(html, /type="submit"/);
});

void it("disables confirmation when no allocated amount remains", () => {
  const html = render({
    options: {
      ...options,
      availableAmountCents: 0,
      allocations: options.allocations.map((row) => ({ ...row, availableAmountCents: 0 })),
    },
  });
  assert.match(html, /<button[^>]*type="submit"[^>]*disabled/);
  assert.match(html, /R\$ 0,00/);
});
