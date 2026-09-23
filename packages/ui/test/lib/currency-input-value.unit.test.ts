import assert from "node:assert/strict";
import test from "node:test";

import {
  appendCurrencyDigit,
  formatCurrencyCents,
  parseCurrencyDigits,
  removeCurrencyDigit,
} from "../../src/lib/currency-input-value";

const SAMPLE_CENTS = 123_456;
const THREE_DIGIT_CENTS = 123;
const TWELVE_CENTS = 12;

void test("each digit shifts the BRL value by one centavo place", () => {
  const one = appendCurrencyDigit(null, "1");
  const twelve = appendCurrencyDigit(one, "2");
  const oneTwentyThree = appendCurrencyDigit(twelve, "3");

  assert.equal(one, 1);
  assert.equal(formatCurrencyCents(one).replaceAll(/\s/gu, " "), "R$ 0,01");
  assert.equal(twelve, TWELVE_CENTS);
  assert.equal(formatCurrencyCents(oneTwentyThree).replaceAll(/\s/gu, " "), "R$ 1,23");
  assert.equal(formatCurrencyCents(SAMPLE_CENTS).replaceAll(/\s/gu, " "), "R$ 1.234,56");
  assert.equal(formatCurrencyCents(Number.MAX_SAFE_INTEGER), "R$ 90.071.992.547.409,91");
});

void test("pasted BRL text, deletion, and empty values preserve integer centavos", () => {
  assert.equal(parseCurrencyDigits("R$ 1.234,56"), SAMPLE_CENTS);
  assert.equal(parseCurrencyDigits("1"), 1);
  assert.equal(parseCurrencyDigits(""), null);
  assert.equal(parseCurrencyDigits("999999999999999999999"), undefined);
  assert.equal(appendCurrencyDigit(Number.MAX_SAFE_INTEGER, "9"), Number.MAX_SAFE_INTEGER);
  assert.equal(removeCurrencyDigit(THREE_DIGIT_CENTS), TWELVE_CENTS);
  assert.equal(removeCurrencyDigit(1), null);
  assert.equal(formatCurrencyCents(0), "R$ 0,00");
  assert.equal(formatCurrencyCents(null), "");
});
