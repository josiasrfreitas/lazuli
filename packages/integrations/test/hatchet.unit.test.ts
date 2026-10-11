import assert from "node:assert/strict";
import { it } from "node:test";
import { sessionWorkflowNamespace } from "../src/hatchet.js";

void it("isolates shared-engine workspaces by database while surviving credential rotation", () => {
  const original = sessionWorkflowNamespace({
    DATABASE_URL: "postgresql://staff:old@localhost:5432/school_a",
  });
  const rotated = sessionWorkflowNamespace({
    DATABASE_URL: "postgresql://staff:new@localhost:5432/school_a",
  });
  const other = sessionWorkflowNamespace({
    DATABASE_URL: "postgresql://staff:old@localhost:5432/school_b",
  });
  assert.equal(original, rotated);
  assert.notEqual(original, other);
  assert.match(original, /^lazuli-[a-f0-9]{16}$/u);
});

void it("honors an explicitly shared production namespace", () => {
  assert.equal(
    sessionWorkflowNamespace({ HATCHET_CLIENT_NAMESPACE: "lazuli-production" }),
    "lazuli-production",
  );
});
