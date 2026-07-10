import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildMonthlyAccountantCsv } from "../src/reports/csv/monthly-accountant-csv.js";
import { buildOverdueReceivablesCsv } from "../src/reports/csv/overdue-receivables-csv.js";

const ORDER_ID = "00000000-0000-0000-0000-000000005310";
const CENTS_450_00 = 45_000;
const CENTS_100_00 = 10_000;
const CENTS_350_00 = 35_000;
const CENTS_200_00 = 20_000;
const OVERDUE_DAYS = 12;

void describe("buildOverdueReceivablesCsv", () => {
  void it("renders the §7.2 columns in pt-BR", () => {
    const csv = buildOverdueReceivablesCsv([
      {
        studentNames: "Ana Souza; Bruno Souza",
        orderId: ORDER_ID,
        dueDate: "2026-06-15",
        currentExpectedCents: CENTS_450_00,
        paidAmountCents: CENTS_100_00,
        collectibleRemainingCents: CENTS_350_00,
        overdueDays: OVERDUE_DAYS,
      },
    ]);
    const lines = csv.replace("\uFEFF", "").trimEnd().split("\r\n");

    assert.equal(
      lines[0],
      "Aluno(s),Pedido,Vencimento,Valor esperado (R$),Pago (R$),Saldo em aberto (R$),Dias em atraso",
    );
    assert.equal(
      lines[1],
      `Ana Souza; Bruno Souza,${ORDER_ID},15/06/2026,"450,00","100,00","350,00",12`,
    );
  });

  void it("renders only the header when there are no overdue rows", () => {
    const csv = buildOverdueReceivablesCsv([]);
    const lines = csv.replace("\uFEFF", "").trimEnd().split("\r\n");

    assert.equal(lines.length, 1);
  });
});

void describe("buildMonthlyAccountantCsv", () => {
  void it("renders payment and waiver rows with pt-BR labels", () => {
    const csv = buildMonthlyAccountantCsv({
      payments: [
        {
          date: "2026-07-05",
          payerName: "Carlos Lima",
          method: "PIX",
          amountCents: CENTS_450_00,
          allocatedCents: CENTS_450_00,
          externalReference: "cora-123",
          note: null,
        },
      ],
      waivers: [
        {
          waivedDate: "2026-07-10",
          payerName: "Diana Prado",
          orderId: ORDER_ID,
          installmentDueDate: "2026-07-15",
          waivedRemainingCents: CENTS_200_00,
          reason: "Acordo com a direção",
        },
      ],
    });
    const lines = csv.replace("\uFEFF", "").trimEnd().split("\r\n");

    assert.equal(
      lines[0],
      "Tipo,Data,Pagador,Método,Valor (R$),Valor alocado (R$),Referência,Observação",
    );
    assert.equal(lines[1], `Pagamento,05/07/2026,Carlos Lima,Pix,"450,00","450,00",cora-123,`);
    assert.equal(
      lines[2],
      `Isenção,10/07/2026,Diana Prado,,"200,00",,Parcela venc. 15/07/2026 — Pedido ${ORDER_ID},Acordo com a direção`,
    );
  });
});
