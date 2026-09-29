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

void it("shows only stage and class codes in the placement column", () => {
  const markup = renderColumn("placement", {
    student: {
      id: "student",
      fullName: "Ana Beatriz Rocha",
      placements: [{ stageCode: "E1", classCode: "2026.2-E1A" }],
    },
  });
  assert.equal(markup.replaceAll(/<[^>]*>/g, ""), "E1 · 2026.2-E1A");
});

for (const [fullName, abbreviated] of [
  ["Patrícia Ferreira", "Patrícia F."],
  ["Bruno", "Bruno"],
] as const) {
  void it(`shows the payer ${abbreviated} with the full name available`, () => {
    const markup = renderColumn("payer", { payer: { id: "payer", name: fullName } });
    assert.ok(markup.includes(`title="${fullName}"`));
    assert.equal(markup.replaceAll(/<[^>]*>/g, ""), abbreviated);
  });
}

void it("shows financial status without a balance column", () => {
  const row: Partial<ContractRow> = {
    status: "INADIMPLENTE",
    financialSummary: {
      overdueCents: 16_000,
      dueTodayCents: 25_000,
      futureCents: 250_000,
      zeroedByAdjustment: 0,
    },
    paymentProgress: { paid: 0, total: 12, waived: 0, cancelled: 0 },
  };
  const status = renderColumn("status", row);
  assert.equal(status.replaceAll(/<[^>]*>/g, ""), "Inadimplente");
  assert.equal(
    contractColumns.some(({ id }) => id === "balance"),
    false,
  );
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
    label: "Cancelada",
    waived: 0,
    zeroed: 0,
    explanation: "Cobrança cancelada",
  },
] as const) {
  void it(`shows only ${label} for ${explanation}, with a single-line term`, () => {
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
    assert.equal(finance.replaceAll(/<[^>]*>/g, ""), label);
    assert.doesNotMatch(service, /Vigente|Não iniciado|Encerrado|data-slot="badge"/);
    assert.match(service, /dateTime="2026-03-15"/);
    assert.match(service, /dateTime="2027-03-15"/);
    assert.match(service, /15 Mar 26<\/time> → <time[^>]*>15 Mar 27/);
  });
}

for (const serviceStatus of ["NOT_STARTED", "ENDED"] as const) {
  void it(`shows only dates for ${serviceStatus} while debt remains overdue`, () => {
    const markup = renderColumn("term", {
      serviceStatus,
      status: "INADIMPLENTE",
      startsOn: "2026-01-31",
      endsOn: "2027-01-31",
    });
    assert.equal(markup.replaceAll(/<[^>]*>/g, ""), "31 Jan 26 → 31 Jan 27");
  });
}
