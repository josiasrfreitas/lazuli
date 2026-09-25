import assert from "node:assert/strict";
import { it } from "node:test";

import { detectPersonDocument } from "../src/person-document.js";

void it("formats a valid CPF and ignores punctuation while detecting it", () => {
  assert.deepEqual(detectPersonDocument("529.982.247-25"), {
    documentType: "CPF",
    documentNumber: "529.982.247-25",
  });
});

void it("uses RG as the fallback for invalid CPF digits and accepts an X verifier", () => {
  assert.deepEqual(detectPersonDocument("52998224726"), {
    documentType: "RG",
    documentNumber: "5.299.822.472-6",
  });
  assert.deepEqual(detectPersonDocument("12.345.678-X"), {
    documentType: "RG",
    documentNumber: "12.345.678-X",
  });
});

void it("leaves incomplete documents unclassified", () => {
  assert.deepEqual(detectPersonDocument("1234"), {
    documentType: undefined,
    documentNumber: "1234",
  });
});
