import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AcademicGrade } from "@lazuli/domain";
import { gradeAverage } from "../../src/features/assessments/grade-average.js";

void describe("current stage overall grade average", () => {
  void it("averages every recorded grade across both blocks and all competences equally", () => {
    const grades: AcademicGrade[] = [
      { competence: "ORAL", phase: "BLOCK_ONE", score: 78 },
      { competence: "ORAL", phase: "BLOCK_TWO", score: 88 },
      { competence: "LISTENING", phase: "BLOCK_ONE", score: 71 },
      { competence: "LISTENING", phase: "BLOCK_TWO", score: 69 },
      { competence: "WRITTEN", phase: "BLOCK_ONE", score: 82 },
      { competence: "WRITTEN", phase: "BLOCK_TWO", score: 81 },
      { competence: "PARTICIPATION", phase: "BLOCK_ONE", score: 72 },
      { competence: "PARTICIPATION", phase: "BLOCK_TWO", score: 81 },
    ];
    // 622 points over eight recorded grades.
    assert.equal(gradeAverage(grades), 77.75);
  });

  void it("counts zero and fractional grades without inserting missing grades into the denominator", () => {
    const grades: AcademicGrade[] = [
      { competence: "ORAL", phase: "BLOCK_ONE", score: 0 },
      { competence: "LISTENING", phase: "BLOCK_ONE", score: 61.5 },
      { competence: "LISTENING", phase: "BLOCK_TWO", score: 90 },
    ];
    assert.equal(gradeAverage(grades), 50.5);
  });

  void it("includes recovery alongside the original grades in the descriptive average", () => {
    const grades: AcademicGrade[] = [
      { competence: "WRITTEN", phase: "BLOCK_ONE", score: 20 },
      { competence: "WRITTEN", phase: "BLOCK_TWO", score: 40 },
      { competence: "WRITTEN", phase: "RECOVERY", score: 90 },
    ];
    assert.equal(gradeAverage(grades), 50);
  });

  void it("keeps an ungraded stage distinct from a recorded zero", () => {
    assert.equal(gradeAverage([]), null);
    assert.equal(gradeAverage([{ score: 0 }]), 0);
  });
});
