import assert from "node:assert/strict";
import { it } from "node:test";
import {
  needsStudentPedagogy,
  needsStudentFinanceSummary,
} from "../../src/features/students/profile/query-policy.js";

void it("loads only the heavy data needed by each student section", () => {
  for (const [section, pedagogy, finance] of [
    ["visao-geral", true, false],
    ["cadastro", false, false],
    ["financeiro", false, true],
    ["pedagogico", true, true],
    ["planejamento", true, false],
  ] as const) {
    assert.equal(needsStudentPedagogy(section), pedagogy, section);
    assert.equal(
      needsStudentFinanceSummary(section, { ready: true, hasPersonalizedEnrollment: true }),
      finance,
      section,
    );
  }
});
void it("loads termination data if planning resolves to the pedagogical section for a regular student", () => {
  assert.equal(
    needsStudentFinanceSummary("planejamento", { ready: false, hasPersonalizedEnrollment: false }),
    false,
  );
  assert.equal(
    needsStudentFinanceSummary("planejamento", { ready: true, hasPersonalizedEnrollment: false }),
    true,
  );
});
