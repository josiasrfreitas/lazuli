import assert from "node:assert/strict";
import { test } from "node:test";
import { createSessions } from "../src/sessions.mjs";

test("test links have no expiration and remain isolated", () => {
  const sessions = createSessions();
  const first = sessions.issue();
  const second = sessions.issue();
  assert.equal(first.expiresAt, null);
  sessions.get(first.token).result = { text: "test" };
  assert.equal(sessions.get(first.token).result.text, "test");
  assert.equal(sessions.get(second.token).result, null);
  assert.equal(createSessions().get(first.token), undefined);
});
