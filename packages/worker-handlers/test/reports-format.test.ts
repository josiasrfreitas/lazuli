import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildCsvDocument, csvEscape } from "../src/reports/csv/csv-format.js";
import {
  formatCentsBRL,
  formatCentsDecimalPtBr,
  formatDateOnlyPtBr,
  formatInstantPtBr,
  formatPercentPtBr,
} from "../src/reports/templates/format.js";

const NBSP = "\u00A0";
const BOM = "\uFEFF";
const CENTS_1234_56 = 123_456;
const CENTS_NEGATIVE_1_00 = -100;
const CENTS_NEGATIVE_99_50 = -9950;
const FRACTION_87_5 = 0.875;

void describe("pt-BR report formatters", () => {
  void it("formats cents as BRL currency", () => {
    assert.equal(formatCentsBRL(CENTS_1234_56), `R$${NBSP}1.234,56`);
    assert.equal(formatCentsBRL(0), `R$${NBSP}0,00`);
    assert.equal(formatCentsBRL(CENTS_NEGATIVE_1_00), `-R$${NBSP}1,00`);
  });

  void it("formats cents as bare pt-BR decimals for CSV columns", () => {
    assert.equal(formatCentsDecimalPtBr(CENTS_1234_56), "1.234,56");
    assert.equal(formatCentsDecimalPtBr(0), "0,00");
    assert.equal(formatCentsDecimalPtBr(CENTS_NEGATIVE_99_50), "-99,50");
  });

  void it("formats @db.Date values as dd/mm/aaaa", () => {
    assert.equal(formatDateOnlyPtBr(new Date("2026-07-09T00:00:00.000Z")), "09/07/2026");
    assert.equal(formatDateOnlyPtBr("2026-01-31"), "31/01/2026");
  });

  void it("formats instants on the America/Sao_Paulo wall clock", () => {
    // 2026-07-09T02:30Z is 23:30 of July 8th in São Paulo (UTC-3).
    assert.equal(formatInstantPtBr(new Date("2026-07-09T02:30:00.000Z")), "08/07/2026 23:30");
  });

  void it("formats attendance fractions with 'sem dados' for null", () => {
    assert.equal(formatPercentPtBr(FRACTION_87_5), "87,5%");
    assert.equal(formatPercentPtBr(1), "100%");
    assert.equal(formatPercentPtBr(null), "sem dados");
  });
});

void describe("CSV serialization", () => {
  void it("escapes delimiters, quotes, and line breaks", () => {
    assert.equal(csvEscape("plain"), "plain");
    assert.equal(csvEscape("a,b"), '"a,b"');
    assert.equal(csvEscape('say "hi"'), '"say ""hi"""');
    assert.equal(csvEscape("line\nbreak"), '"line\nbreak"');
  });

  void it("builds a BOM-prefixed CRLF document", () => {
    const document = buildCsvDocument([
      ["Nome", "Valor (R$)"],
      ["João, o aluno", "1.234,56"],
    ]);

    assert.equal(document, `${BOM}Nome,Valor (R$)\r\n"João, o aluno","1.234,56"\r\n`);
  });
});
