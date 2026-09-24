import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  contractPartySearchInputSchema,
  createMonthlyContractInputSchema,
  listContractsInputSchema,
} from "../src/contracts.js";

const VALID_INPUT = {
  commandId: "00000000-0000-4000-8000-000000000001",
  studentId: "00000000-0000-4000-8000-000000000002",
  payerId: "00000000-0000-4000-8000-000000000003",
  agreedOn: "2026-03-15",
  startsOn: "2026-03-15",
  durationMonths: 12,
  firstDueDate: "2026-03-31",
  monthlyAmountCents: 25_000,
  punctualityDiscountPct: 20,
};
const MAX_DURATION_MONTHS = 120;
const MAX_MONTHLY_AMOUNT_CENTS = 1_000_000_000;
const FOUR_DECIMAL_DISCOUNT_PCT = 20.0001;
const TOO_LONG_QUERY_LENGTH = 81;
const TOO_LONG_QUERY = "a".repeat(TOO_LONG_QUERY_LENGTH);

void describe("monthly contract input", () => {
  void it("accepts civil dates, the full duration and price limits, and four decimal places", () => {
    const parsed = createMonthlyContractInputSchema.parse({
      ...VALID_INPUT,
      durationMonths: MAX_DURATION_MONTHS,
      monthlyAmountCents: MAX_MONTHLY_AMOUNT_CENTS,
      punctualityDiscountPct: FOUR_DECIMAL_DISCOUNT_PCT,
    });
    assert.equal(parsed.firstDueDate, "2026-03-31");
    assert.equal(parsed.durationMonths, MAX_DURATION_MONTHS);
    assert.equal(parsed.monthlyAmountCents, MAX_MONTHLY_AMOUNT_CENTS);
    assert.equal(parsed.punctualityDiscountPct, FOUR_DECIMAL_DISCOUNT_PCT);
  });

  for (const [label, change] of [
    ["missing payer", { payerId: "invalid" }],
    ["invalid date", { startsOn: "2026-02-30" }],
    ["zero months", { durationMonths: 0 }],
    ["more than 120 months", { durationMonths: 121 }],
    ["zero monthly price", { monthlyAmountCents: 0 }],
    ["price above limit", { monthlyAmountCents: 1_000_000_001 }],
    ["negative discount", { punctualityDiscountPct: -1 }],
    ["discount above 100", { punctualityDiscountPct: 100.0001 }],
    ["fifth decimal place", { punctualityDiscountPct: Number("20.00001") }],
    ["non-finite discount", { punctualityDiscountPct: Number.POSITIVE_INFINITY }],
    ["unknown field", { extra: true }],
  ] as const) {
    void it(`rejects ${label}`, () => {
      assert.equal(
        createMonthlyContractInputSchema.safeParse({ ...VALID_INPUT, ...change }).success,
        false,
      );
    });
  }
});

void describe("contract search input", () => {
  void it("defaults the list and trims a search", () => {
    assert.deepEqual(listContractsInputSchema.parse({}), { page: 1, query: "" });
    assert.deepEqual(listContractsInputSchema.parse({ page: 2, query: "  Ana  " }), {
      page: 2,
      query: "Ana",
    });
    assert.deepEqual(contractPartySearchInputSchema.parse({ query: "  Patrícia  " }), {
      query: "Patrícia",
    });
  });
  void it("rejects invalid pages and searches longer than 80 characters", () => {
    assert.equal(listContractsInputSchema.safeParse({ page: 0 }).success, false);
    assert.equal(listContractsInputSchema.safeParse({ query: TOO_LONG_QUERY }).success, false);
    assert.equal(
      contractPartySearchInputSchema.safeParse({ query: TOO_LONG_QUERY }).success,
      false,
    );
  });
});

void describe("inline contract payer input", () => {
  void it("preserves the serialized P05 input for persisted command fingerprints", () => {
    assert.equal(
      JSON.stringify(createMonthlyContractInputSchema.parse(VALID_INPUT)),
      JSON.stringify(VALID_INPUT),
    );
  });

  for (const document of [
    {},
    { documentType: null, documentNumber: null },
    { documentType: "CPF", documentNumber: "123.456.789-00" },
    { documentType: "RG", documentNumber: "12.345.678-X" },
    { documentType: "RG" },
  ]) {
    void it(`accepts an inline payer with ${JSON.stringify(document)}`, () => {
      const { payerId: _payerId, ...contract } = VALID_INPUT;
      const payer = {
        name: "  Maria  ",
        phone: " 123 ",
        email: " maria@example.com ",
        ...document,
      };
      const parsed = createMonthlyContractInputSchema.parse({ ...contract, newPayer: payer });
      assert.deepEqual(parsed.newPayer, {
        ...document,
        name: "Maria",
        phone: "123",
        email: "maria@example.com",
      });
      assert.equal(parsed.payerId, undefined);
    });
  }
});

void it("normalizes document text and reports errors at fields the contract form can address", () => {
  const { payerId: _payerId, ...contract } = VALID_INPUT;
  const parsed = createMonthlyContractInputSchema.parse({
    ...contract,
    newPayer: { name: "Maria", documentType: "RG", documentNumber: " 123 " },
  });
  assert.equal(parsed.newPayer?.documentNumber, "123");
  const blank = createMonthlyContractInputSchema.safeParse({
    ...contract,
    newPayer: { name: "Maria", documentType: "RG", documentNumber: " " },
  });
  assert.equal(blank.success, false);
  assert.deepEqual(
    blank.error?.issues.map(({ path, message }) => ({ path, message })),
    [{ path: ["newPayer", "documentNumber"], message: "Informe o número do documento." }],
  );
  const missing = createMonthlyContractInputSchema.safeParse(contract);
  assert.deepEqual(
    missing.error?.issues.map(({ path, message }) => ({ path, message })),
    [{ path: ["payerId"], message: "Selecione um pagador existente ou cadastre um novo." }],
  );
  const untyped = createMonthlyContractInputSchema.safeParse({
    ...contract,
    newPayer: { name: "Maria", documentNumber: "123" },
  });
  assert.deepEqual(
    untyped.error?.issues.map(({ path, message }) => ({ path, message })),
    [
      {
        path: ["newPayer", "documentType"],
        message: "Informe o tipo do documento quando preencher o numero.",
      },
    ],
  );
});

void describe("invalid inline contract payer input", () => {
  for (const [label, payer] of [
    ["blank name", { name: " " }],
    ["number without type", { name: "Maria", documentNumber: "123" }],
    ["number with null type", { name: "Maria", documentType: null, documentNumber: "123" }],
    ["unknown type", { name: "Maria", documentType: "CNPJ" }],
    ["untyped legacy input", { name: "Maria", taxId: "123" }],
  ] as const) {
    void it(`rejects an inline payer with ${label}`, () => {
      const { payerId: _payerId, ...contract } = VALID_INPUT;
      assert.equal(
        createMonthlyContractInputSchema.safeParse({ ...contract, newPayer: payer }).success,
        false,
      );
    });
  }
  void it("requires exactly one payer source", () => {
    const { payerId: _payerId, ...contract } = VALID_INPUT;
    assert.equal(createMonthlyContractInputSchema.safeParse(contract).success, false);
    assert.equal(
      createMonthlyContractInputSchema.safeParse({ ...VALID_INPUT, newPayer: { name: "Maria" } })
        .success,
      false,
    );
  });
});
