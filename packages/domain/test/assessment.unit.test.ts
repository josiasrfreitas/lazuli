import assert from "node:assert/strict";
import { it } from "node:test";
import { assessmentResults, assessmentStatus, type AcademicGrade } from "../src/assessment.js";

void it("keeps absent blocks unknown instead of treating them as zero", () => {
  const results = assessmentResults([{ competence: "ORAL", phase: "BLOCK_ONE", score: 80 }]);
  assert.deepEqual(results[0], {
    competence: "ORAL",
    blockOne: 80,
    blockTwo: null,
    average: null,
    recovery: null,
    effective: null,
    passed: null,
  });
  assert.equal(assessmentStatus(results), "INCOMPLETE");
  assert.equal(assessmentStatus([]), "INCOMPLETE");
});
void it("requires sixty in every competence without rounding or compensation", () => {
  const grades: AcademicGrade[] = (["LISTENING", "WRITTEN", "PARTICIPATION"] as const).flatMap(
    (competence) => [
      { competence, phase: "BLOCK_ONE" as const, score: 100 },
      { competence, phase: "BLOCK_TWO" as const, score: 100 },
    ],
  );
  grades.push(
    { competence: "ORAL", phase: "BLOCK_ONE", score: 59.9 },
    { competence: "ORAL", phase: "BLOCK_TWO", score: 60 },
  );
  const results = assessmentResults(grades);
  assert.equal(results[0]?.effective, 59.95);
  assert.equal(results[0]?.passed, false);
  assert.equal(assessmentStatus(results), "NEEDS_SUPPORT");
});
void it("recovery replaces only its competence while preserving both original blocks", () => {
  const results = assessmentResults([
    { competence: "ORAL", phase: "BLOCK_ONE", score: 40 },
    { competence: "ORAL", phase: "BLOCK_TWO", score: 50 },
    { competence: "ORAL", phase: "RECOVERY", score: 60 },
    { competence: "WRITTEN", phase: "RECOVERY", score: 90 },
  ]);
  assert.deepEqual(results[0], {
    competence: "ORAL",
    blockOne: 40,
    blockTwo: 50,
    average: 45,
    recovery: 60,
    effective: 60,
    passed: true,
  });
  assert.equal(results[2]?.effective, null);
  assert.equal(assessmentStatus(results), "INCOMPLETE");
});
