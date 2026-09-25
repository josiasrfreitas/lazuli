import assert from "node:assert/strict";
import { it } from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ContractPaymentProgress } from "../../src/features/contracts/contract-payment-progress.js";
import {
  contractColumns,
  type ContractRow,
} from "../../src/features/contracts/contract-columns.js";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

void it("renders the payment column with readable counts and an accessible proportional bar", () => {
  const column = contractColumns.find(({ id }) => id === "paymentProgress");
  assert.ok(column);
  const markup = renderToStaticMarkup(
    React.createElement(
      React.Fragment,
      null,
      column.cell({
        paymentProgress: { paid: 5, total: 12, waived: 2, cancelled: 0 },
      } as ContractRow),
    ),
  );
  assert.match(markup, /5 de 12 pagas/);
  assert.match(markup, /2 dispensadas/);
  assert.match(markup, /role="progressbar"/);
  assert.match(markup, /aria-label="Parcelas pagas"/);
  assert.match(markup, /aria-valuemin="0"/);
  assert.match(markup, /aria-valuemax="12"/);
  assert.match(markup, /aria-valuenow="5"/);
  assert.match(markup, /aria-valuetext="5 de 12 pagas; 2 dispensadas"/);
  assert.match(markup, /--payment-progress:41\.66666666666667%/);
});

for (const { progress, text, width, exceptions } of [
  {
    progress: { paid: 0, total: 12, waived: 0, cancelled: 0 },
    text: "0 de 12 pagas",
    width: "0%",
    exceptions: "",
  },
  {
    progress: { paid: 12, total: 12, waived: 0, cancelled: 0 },
    text: "12 de 12 pagas",
    width: "100%",
    exceptions: "",
  },
  {
    progress: { paid: 0, total: 12, waived: 12, cancelled: 0 },
    text: "0 de 12 pagas",
    width: "0%",
    exceptions: "12 dispensadas",
  },
  {
    progress: { paid: 1, total: 3, waived: 1, cancelled: 1 },
    text: "1 de 3 pagas",
    width: "33.33333333333333%",
    exceptions: "1 dispensada · 1 cancelada",
  },
  {
    progress: { paid: 5, total: 12, waived: 2, cancelled: 5 },
    text: "5 de 12 pagas",
    width: "41.66666666666667%",
    exceptions: "2 dispensadas · 5 canceladas",
  },
]) {
  void it(`describes ${text} with ${exceptions || "no exceptions"}`, () => {
    const markup = renderToStaticMarkup(React.createElement(ContractPaymentProgress, { progress }));
    assert.ok(
      markup.includes(`>${text}</span>`),
      "visible count must remain readable without color",
    );
    assert.ok(
      markup.includes(`--payment-progress:${width}`),
      "bar must represent paid installments only",
    );
    assert.ok(markup.includes(`aria-valuetext="${[text, exceptions].filter(Boolean).join("; ")}"`));
    assert.equal(
      markup.match(/<span[^>]*class="text-micro[^"]*">([^<]*)<\/span>/)?.[1] ?? "",
      exceptions,
    );
  });
}
