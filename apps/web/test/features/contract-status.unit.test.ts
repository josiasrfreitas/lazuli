import assert from "node:assert/strict";
import { it } from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  contractColumns,
  type ContractRow,
} from "../../src/features/contracts/contract-columns.js";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

function renderColumn(id: string, row: Partial<ContractRow>): string {
  const column = contractColumns.find((candidate) => candidate.id === id);
  assert.ok(column);
  return renderToStaticMarkup(
    React.createElement(React.Fragment, null, column.cell(row as ContractRow)),
  );
}

void it("shows overdue, today and future amounts as recorded balances with visible labels", () => {
  const markup = renderColumn("status", {
    status: "INADIMPLENTE",
    financialSummary: {
      overdueCents: 16_000,
      dueTodayCents: 25_000,
      futureCents: 250_000,
      zeroedByAdjustment: 0,
    },
    paymentProgress: { paid: 0, total: 12, waived: 0, cancelled: 0 },
  });
  assert.match(markup, /Inadimplente/);
  assert.match(markup, /Em atraso: R\$\s*160,00/);
  assert.match(markup, /Vence hoje: R\$\s*250,00/);
  assert.match(markup, /A vencer: R\$\s*2\.500,00/);
  assert.match(markup, /Saldos registrados · sem prévias/);
});

for (const { status, label, waived, zeroed, explanation } of [
  { status: "QUITADO", label: "Quitado", waived: 0, zeroed: 0, explanation: "Quitado" },
  {
    status: "SEM_SALDO",
    label: "Sem saldo a cobrar",
    waived: 12,
    zeroed: 0,
    explanation: "Inclui dispensa de parcelas",
  },
  {
    status: "SEM_SALDO",
    label: "Sem saldo a cobrar",
    waived: 0,
    zeroed: 1,
    explanation: "1 parcela zerada por ajuste",
  },
  {
    status: "CANCELADO",
    label: "Cobrança cancelada",
    waived: 0,
    zeroed: 0,
    explanation: "Cobrança cancelada",
  },
] as const) {
  void it(`renders ${explanation} independently from an active service`, () => {
    const row: Partial<ContractRow> = {
      status,
      serviceStatus: "ACTIVE",
      startsOn: "2026-03-15",
      endsOn: "2027-03-15",
      financialSummary: {
        overdueCents: 0,
        dueTodayCents: 0,
        futureCents: 0,
        zeroedByAdjustment: zeroed,
      },
      paymentProgress: { paid: status === "QUITADO" ? 12 : 0, total: 12, waived, cancelled: 0 },
    };
    const finance = renderColumn("status", row);
    const service = renderColumn("term", row);
    assert.ok(finance.includes(label));
    assert.ok(finance.includes(explanation));
    assert.doesNotMatch(finance, /Em atraso:|A vencer:|Vence hoje:/);
    assert.match(service, /Vigente/);
    assert.match(service, /dateTime="2026-03-15"/);
    assert.match(service, /dateTime="2027-03-15"/);
    assert.match(service, /15 Mar 27/);
  });
}

for (const [serviceStatus, label] of [
  ["NOT_STARTED", "Não iniciado"],
  ["ENDED", "Encerrado"],
] as const) {
  void it(`renders service ${label} while debt remains overdue`, () => {
    const markup = renderColumn("term", {
      serviceStatus,
      status: "INADIMPLENTE",
      startsOn: "2026-01-31",
      endsOn: "2027-01-31",
    });
    assert.ok(markup.includes(label));
    assert.match(markup, /31 Jan 26/);
    assert.match(markup, /31 Jan 27/);
  });
}
