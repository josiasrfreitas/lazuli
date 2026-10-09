import assert from "node:assert/strict";
import { it } from "node:test";

import { sessionRedirect } from "../../src/lib/session-sync.js";

void it("discards the previous account after a direct non-null replacement session", () => {
  assert.equal(
    sessionRedirect({
      renderedEmail: "previous@example.com",
      currentEmail: "replacement@example.com",
      isPending: false,
      hasError: false,
    }),
    "/",
  );
});

void it("returns signed-out screens to login after successful session resolution", () => {
  assert.equal(
    sessionRedirect({
      renderedEmail: "previous@example.com",
      currentEmail: null,
      isPending: false,
      hasError: false,
    }),
    "/login",
  );
});

void it("keeps the current account and ignores pending or unsuccessful refetches", () => {
  for (const state of [
    { currentEmail: "current@example.com", isPending: false, hasError: false },
    { currentEmail: null, isPending: true, hasError: false },
    { currentEmail: null, isPending: false, hasError: true },
    { currentEmail: "other@example.com", isPending: true, hasError: false },
    { currentEmail: "other@example.com", isPending: false, hasError: true },
  ]) {
    assert.equal(sessionRedirect({ renderedEmail: "current@example.com", ...state }), null);
  }
});
