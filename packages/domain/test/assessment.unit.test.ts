import assert from "node:assert/strict";
import { it } from "node:test";
import {
  assessmentResults,
  assessmentStatus,
  type AcademicGrade,
  ACADEMIC_COMPETENCES,
} from "../src/assessment.js";

// Issue #175: each competence independently needs 60; exactly 60 passes, without rounding.
function completeGrades(oralOne: number, oralTwo: number): AcademicGrade[] {
  return ACADEMIC_COMPETENCES.flatMap((competence) => [
    { competence, phase: "BLOCK_ONE" as const, score: competence === "ORAL" ? oralOne : 100 },
    { competence, phase: "BLOCK_TWO" as const, score: competence === "ORAL" ? oralTwo : 100 },
  ]);
}

void it("passes exactly 60 per competence and never rounds 59.95 or compensates it with other grades", () => {
  const threshold = assessmentResults(completeGrades(60, 60));
  assert.equal(threshold[0]!.average, 60);
  assert.equal(assessmentStatus(threshold), "SUFFICIENT");
  const below = assessmentResults(completeGrades(59.9, 60));
  assert.equal(below[0]!.average, 59.95);
  assert.equal(below[0]!.passed, false);
  assert.equal(assessmentStatus(below), "NEEDS_SUPPORT");
});

void it("keeps missing block grades explicit even with recovery, and substitutes recovery without replacing the original blocks", () => {
  const incomplete = assessmentResults([{ competence: "ORAL", phase: "RECOVERY", score: 100 }]);
  assert.deepEqual(incomplete[0], {
    competence: "ORAL",
    blockOne: null,
    blockTwo: null,
    average: null,
    recovery: 100,
    effective: null,
    passed: null,
  });
  assert.equal(assessmentStatus(incomplete), "INCOMPLETE");
  const recovered = assessmentResults([
    ...completeGrades(50, 60),
    { competence: "ORAL", phase: "RECOVERY", score: 60 },
  ]);
  assert.deepEqual(recovered[0], {
    competence: "ORAL",
    blockOne: 50,
    blockTwo: 60,
    average: 55,
    recovery: 60,
    effective: 60,
    passed: true,
  });
  assert.equal(assessmentStatus(recovered), "SUFFICIENT");
});
