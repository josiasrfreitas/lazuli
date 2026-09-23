import assert from "node:assert/strict";
import test from "node:test";

import {
  appendCurrencyDigit,
  formatCurrencyCents,
  parseCurrencyDigits,
  removeCurrencyDigit,
} from "../../src/lib/currency-input-value";

test("each digit shifts the BRL value by one centavo place", () => {
  const one = appendCurrencyDigit(null, "1");
  const twelve = appendCurrencyDigit(one, "2");
  const oneTwentyThree = appendCurrencyDigit(twelve, "3");

  assert.equal(one, 1);
  assert.equal(formatCurrencyCents(one).replace(/\s/gu, " "), "R$ 0,01");
  assert.equal(twelve, 12);
  assert.equal(formatCurrencyCents(oneTwentyThree).replace(/\s/gu, " "), "R$ 1,23");
  assert.equal(formatCurrencyCents(123456).replace(/\s/gu, " "), "R$ 1.234,56");
  assert.equal(formatCurrencyCents(Number.MAX_SAFE_INTEGER), "R$ 90.071.992.547.409,91");
});

test("pasted BRL text, deletion, and empty values preserve integer centavos", () => {
  assert.equal(parseCurrencyDigits("R$ 1.234,56"), 123456);
  assert.equal(parseCurrencyDigits("1"), 1);
  assert.equal(parseCurrencyDigits(""), null);
  assert.equal(parseCurrencyDigits("999999999999999999999"), undefined);
  assert.equal(appendCurrencyDigit(Number.MAX_SAFE_INTEGER, "9"), Number.MAX_SAFE_INTEGER);
  assert.equal(removeCurrencyDigit(123), 12);
  assert.equal(removeCurrencyDigit(1), null);
  assert.equal(formatCurrencyCents(0), "R$ 0,00");
  assert.equal(formatCurrencyCents(null), "");
});
