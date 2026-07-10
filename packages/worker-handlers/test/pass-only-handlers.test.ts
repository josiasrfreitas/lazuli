import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { sendOverdueD30, sendOverdueDigest, sendPortalFailureEmail } from "../src/index.js";

const PORTAL_RUN_ID = "00000000-0000-0000-0000-000000000067";
const INSTALLMENT_ID = "00000000-0000-0000-0000-000000000068";

void describe("pass-only worker handlers", () => {
  void it("sendPortalFailureEmail logs and returns the portal run id", async () => {
    const result = await sendPortalFailureEmail({ payload: { portalRunId: PORTAL_RUN_ID } });
    assert.deepEqual(result, { portalRunId: PORTAL_RUN_ID });
  });

  void it("sendOverdueDigest resolves without side effects", async () => {
    await assert.doesNotReject(() => sendOverdueDigest({ payload: {} }));
  });

  void it("sendOverdueD30 logs and returns the installment id", async () => {
    const result = await sendOverdueD30({ payload: { installmentId: INSTALLMENT_ID } });
    assert.deepEqual(result, { installmentId: INSTALLMENT_ID });
  });
});
