import assert from "node:assert/strict";
import { it } from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  contractInputFromFields,
  contractPreview,
  emptyContractFields,
} from "../../src/features/contracts/contract-form-model.js";
import { fieldErrors } from "../../src/features/contracts/new-contract-state.js";
import { PaymentSection } from "../../src/features/contracts/contract-payment-section.js";
import { paymentPlanLabel } from "../../src/features/contracts/contract-payment-summary.js";

(globalThis as typeof globalThis & { React: typeof React }).React = React;
const commandId = "00000000-0000-4000-8000-000000000001";
const fields = {
  ...emptyContractFields,
  studentId: "00000000-0000-4000-8000-000000000002",
  payerId: "00000000-0000-4000-8000-000000000003",
  agreedOn: "31/01/2026",
  firstDueDate: "31/01/2026",
  endsOn: "31/05/2026",
  monthlyAmount: "250,00",
  paymentPlan: "special",
  installmentCount: "3",
};
const offer = {
  tuitionCeilingCents: 25_000,
  maximumDiscountPct: 20,
  punctualityDiscountPct: 20,
  interestRatePctDaily: 0.1,
  interestRatePctMonthly: 2,
  cancellationFeePct: 10,
};

void it("submits the active plan and ignores the inactive special draft", () => {
  assert.equal(contractInputFromFields(fields, commandId).data?.installmentCount, 3);
  const common = { ...fields, paymentPlan: "common", installmentCount: "invalid" };
  const parsed = contractInputFromFields(common, commandId);
  assert.equal(parsed.success, true);
  assert.equal(Object.hasOwn(parsed.data, "installmentCount"), false);
  assert.equal(contractPreview(common, offer)?.installments.length, 4);
  const special = contractPreview(fields, offer);
  assert.deepEqual(
    special?.installments.map((row) => row.amountCents),
    [33333, 33333, 33334],
  );
  assert.equal(special?.endsOn, "2026-05-31");
});

for (const installmentCount of ["", "0", "1.5", "5", "invalid"]) {
  void it(`directs quantity error to its field for ${JSON.stringify(installmentCount)}`, () => {
    const invalid = { ...fields, installmentCount };
    const parsed = contractInputFromFields(invalid, commandId);
    assert.deepEqual(fieldErrors(parsed, false), {
      installmentCount: "Informe uma quantidade inteira entre 1 e a duração do contrato em meses.",
    });
    assert.equal(contractPreview(invalid, offer), null);
  });
}

void it("shows nominal calendar entries and a truthful variable summary", () => {
  const markup = renderToStaticMarkup(
    React.createElement(PaymentSection, {
      fields,
      errors: {},
      offer,
      preview: contractPreview(fields, offer),
      change: () => {},
    }),
  );
  assert.match(markup, /3 parcelas · valores variáveis/);
  assert.match(markup, /Ver calendário completo/);
  assert.match(markup, /31\/01\/2026/);
  assert.match(markup, /28\/02\/2026/);
  assert.match(markup, /31\/03\/2026/);
  assert.match(markup, /333,34/);
  assert.match(markup, /Voltar ao plano comum/);
  assert.match(markup, /name="installmentCount"/);
  assert.equal(paymentPlanLabel(3, null), "3 parcelas · valores variáveis");
  assert.match(paymentPlanLabel(3, 100_000), /^3 × R\$\s1\.000,00$/);
});
