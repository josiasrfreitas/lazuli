import assert from "node:assert/strict";
import { it } from "node:test";
import { applyQrReview } from "../../src/features/class-records/qr-review.js";
void it("requires review of untouched default presence when QR starts during an open diary draft", () => {
  const rows = [
    {
      enrollmentId: "ana",
      status: "PRESENT" as const,
      reviewed: true,
      manuallyReviewed: false,
      account: "Relato já digitado",
    },
    {
      enrollmentId: "bia",
      status: "PRESENT" as const,
      reviewed: true,
      manuallyReviewed: false,
      account: "",
    },
    {
      enrollmentId: "caio",
      status: "ABSENT" as const,
      reviewed: true,
      manuallyReviewed: true,
      account: "",
    },
  ];
  const result = applyQrReview(rows, ["ana", "caio"]);
  assert.deepEqual(
    result.map(({ enrollmentId, status, reviewed }) => ({ enrollmentId, status, reviewed })),
    [
      { enrollmentId: "ana", status: "PRESENT", reviewed: true },
      { enrollmentId: "bia", status: "ABSENT", reviewed: false },
      { enrollmentId: "caio", status: "ABSENT", reviewed: true },
    ],
  );
  assert.equal(result[0]!.account, "Relato já digitado");
  assert.equal(rows[1]!.status, "PRESENT");
});
