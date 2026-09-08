import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createCaller } from "@lazuli/api";

import { ADMIN_FIXTURE, contextFor } from "../support/support.js";

void describe("students.search input", () => {
  void it("rejects a blank query before reaching the database", async () => {
    const caller = createCaller(contextFor(ADMIN_FIXTURE));

    await assert.rejects(caller.students.search({ query: "   " }), /Campo obrigatorio/);
  });
});
