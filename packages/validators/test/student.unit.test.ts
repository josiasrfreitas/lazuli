import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DOCUMENT_NUMBER_REQUIRES_TYPE_MESSAGE, studentCreateInputSchema } from "../src/student.js";

void describe("student input", () => {
  void it("requires a document type when a document number is filled", () => {
    const result = studentCreateInputSchema.safeParse({
      fullName: "Ana Souza",
      documentNumber: "12345678900",
    });

    assert.deepEqual(result.error?.issues, [
      {
        code: "custom",
        message: DOCUMENT_NUMBER_REQUIRES_TYPE_MESSAGE,
        path: ["documentType"],
      },
    ]);
  });

  void it("accepts a document number with its document type", () => {
    const result = studentCreateInputSchema.safeParse({
      fullName: "Ana Souza",
      documentType: "CPF",
      documentNumber: "12345678900",
    });

    assert.equal(result.success, true);
  });

  void it("rejects a filled document number with a null document type", () => {
    const result = studentCreateInputSchema.safeParse({
      fullName: "Ana Souza",
      documentType: null,
      documentNumber: "12345678900",
    });

    assert.equal(result.error?.issues[0]?.message, DOCUMENT_NUMBER_REQUIRES_TYPE_MESSAGE);
  });

  void it("accepts omitted document fields", () => {
    const result = studentCreateInputSchema.safeParse({ fullName: "Ana Souza" });

    assert.equal(result.success, true);
  });

  void it("accepts a null document number without a document type", () => {
    const result = studentCreateInputSchema.safeParse({
      fullName: "Ana Souza",
      documentNumber: null,
    });

    assert.equal(result.success, true);
  });
});
