import assert from "node:assert/strict";
import { it } from "node:test";
import { placementFileBytes } from "../../src/admissions/placement-file-bytes.js";

void it("retains every uploaded byte after checking the declared PDF, JPEG or PNG header", () => {
  const files = [
    { contentType: "application/pdf", bytes: [37, 80, 68, 70, 45, 0, 255, 128] },
    { contentType: "image/jpeg", bytes: [255, 216, 255, 0, 128, 1] },
    { contentType: "image/png", bytes: [137, 80, 78, 71, 13, 10, 26, 10, 255] },
  ] as const;
  for (const file of files) {
    const uploaded = Buffer.from(file.bytes);
    const result = placementFileBytes({
      contentType: file.contentType,
      base64: uploaded.toString("base64"),
    });
    assert.deepEqual(result, uploaded, file.contentType);
  }
});

void it("rejects empty, truncated or mismatched headers with the existing public error", () => {
  const invalidFiles = [
    { label: "truncated PDF", contentType: "application/pdf", bytes: [37, 80] },
    { label: "truncated JPEG", contentType: "image/jpeg", bytes: [255, 216] },
    { label: "truncated PNG", contentType: "image/png", bytes: [137, 80, 78, 71] },
    { label: "JPEG claimed as PDF", contentType: "application/pdf", bytes: [255, 216, 255] },
    { label: "PDF claimed as JPEG", contentType: "image/jpeg", bytes: [37, 80, 68, 70, 45] },
  ] as const;
  for (const file of invalidFiles) {
    assert.throws(
      () =>
        placementFileBytes({
          contentType: file.contentType,
          base64: Buffer.from(file.bytes).toString("base64"),
        }),
      {
        code: "BAD_REQUEST",
        message: "O conteúdo não corresponde a um arquivo PDF, JPG ou PNG válido.",
      },
      file.label,
    );
  }
  assert.throws(() => placementFileBytes({ contentType: "application/pdf", base64: "" }), {
    code: "BAD_REQUEST",
    message: "Envie um arquivo de até 50 MB.",
  });
});
