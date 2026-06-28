import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createCaller, type Context, type StaffUser } from "@lazuli/api";

const STAFF_USER: StaffUser = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "admin@example.com",
  role: "ADMIN",
  isEnabled: true,
};

/** The seam tests never touch the database, so a typed empty stand-in is enough. */
function contextFor(staffUser: StaffUser | null): Context {
  return { db: {} as Context["db"], staffUser };
}

void describe("appRouter procedure seam", () => {
  void it("health is public and returns ok", async () => {
    const result = await createCaller(contextFor(null)).health();
    assert.deepEqual(result, { status: "ok" });
  });

  void it("me returns the staff user when authenticated", async () => {
    const result = await createCaller(contextFor(STAFF_USER)).me();
    assert.deepEqual(result, STAFF_USER);
  });

  void it("me rejects when unauthenticated", async () => {
    await assert.rejects(createCaller(contextFor(null)).me(), /UNAUTHORIZED/);
  });
});
