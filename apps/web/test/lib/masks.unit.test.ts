import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { maskDateBR, maskPhoneBR, parseDateBR } from "../src/lib/masks.js";

const FULL_DATE = "02/09/2008";

void describe("maskDateBR", () => {
  void it("inserts the separators as digits arrive and ignores anything else", () => {
    assert.equal(maskDateBR(""), "");
    assert.equal(maskDateBR("0"), "0");
    assert.equal(maskDateBR("02"), "02");
    assert.equal(maskDateBR("029"), "02/9");
    assert.equal(maskDateBR("0209"), "02/09");
    assert.equal(maskDateBR("02092008"), FULL_DATE);
    assert.equal(maskDateBR(FULL_DATE), FULL_DATE);
    assert.equal(maskDateBR("02-09-2008-99"), FULL_DATE);
  });
});

void describe("parseDateBR", () => {
  void it("returns the ISO day for a complete, real date", () => {
    assert.equal(parseDateBR(FULL_DATE), "2008-09-02");
    assert.equal(parseDateBR("29/02/2024"), "2024-02-29");
  });

  void it("rejects partial, impossible, or ancient dates", () => {
    assert.equal(parseDateBR(""), null);
    assert.equal(parseDateBR("02/09"), null);
    assert.equal(parseDateBR("31/02/2010"), null);
    assert.equal(parseDateBR("29/02/2023"), null);
    assert.equal(parseDateBR("00/01/2010"), null);
    assert.equal(parseDateBR("01/13/2010"), null);
    assert.equal(parseDateBR("01/01/1899"), null);
  });
});

void describe("maskPhoneBR", () => {
  void it("formats mobile and landline numbers as they are typed", () => {
    assert.equal(maskPhoneBR(""), "");
    assert.equal(maskPhoneBR("1"), "(1");
    assert.equal(maskPhoneBR("11"), "(11");
    assert.equal(maskPhoneBR("119"), "(11) 9");
    assert.equal(maskPhoneBR("1199999"), "(11) 9999-9");
    assert.equal(maskPhoneBR("1199998888"), "(11) 9999-8888");
    assert.equal(maskPhoneBR("11999998888"), "(11) 99999-8888");
    assert.equal(maskPhoneBR("+55 (11) 99999-8888 x"), "(55) 11999-9988");
  });
});
