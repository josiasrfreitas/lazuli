import assert from "node:assert/strict";
import { it } from "node:test";
import { assertTeachingProgram, type TeachingProgramImport } from "../src/teaching-program.js";

export function programInput(stageId: string): TeachingProgramImport {
  return {
    stageId,
    scheduleType: "REGULAR",
    source: {
      provider: "program-test",
      reference: "Independently specified three-hour unit",
      revision: "v1",
    },
    modality: { code: "PROGRAM_TEST_2H", name: "Duas horas semanais", weeklyMinutes: 120 },
    lessons: [{ key: "lesson-1", sequence: 1, title: "Conversas" }],
    units: [{ key: "unit-1", sequence: 1, title: "Unidade 1" }],
    teachingHours: [1, 2, 3].map((sequence) => ({
      key: `hour-${sequence}`,
      sequence,
      durationMinutes: 60,
    })),
    assessments: [{ key: "test-1", unitKey: "unit-1", sequence: 1, title: "Prova oral e escrita" }],
    activities: [
      {
        key: "content",
        sequence: 1,
        unitKey: "unit-1",
        teachingHourKey: "hour-1",
        durationMinutes: 30,
        kind: "LESSON",
        title: "Perguntas em duplas",
        sourceCode: "1A",
        descriptionPending: false,
        assessmentKey: null,
        lessons: [{ key: "lesson-1", part: "A" }],
      },
      {
        key: "review",
        sequence: 2,
        unitKey: "unit-1",
        teachingHourKey: "hour-1",
        durationMinutes: 30,
        kind: "REVIEW",
        title: "Revisão oral",
        sourceCode: "REVIEW",
        descriptionPending: false,
        assessmentKey: null,
        lessons: [],
      },
      {
        key: "test-a",
        sequence: 3,
        unitKey: "unit-1",
        teachingHourKey: "hour-2",
        durationMinutes: 60,
        kind: "ASSESSMENT",
        title: "Prova oral",
        sourceCode: "TEST",
        descriptionPending: false,
        assessmentKey: "test-1",
        lessons: [],
      },
      {
        key: "test-b",
        sequence: 4,
        unitKey: "unit-1",
        teachingHourKey: "hour-3",
        durationMinutes: 60,
        kind: "ASSESSMENT",
        title: "Prova escrita",
        sourceCode: "TEST",
        descriptionPending: false,
        assessmentKey: "test-1",
        lessons: [],
      },
    ],
  };
}

void it("rejects invented book references and teaching hours with missing minutes", () => {
  const input = programInput("00000000-0000-0000-0000-000000000001");
  input.activities[0]!.lessons[0]!.key = "unknown-book-lesson";
  assert.throws(() => assertTeachingProgram(input), /lição desconhecida/);
  input.activities[0]!.lessons[0]!.key = "lesson-1";
  input.activities[0]!.durationMinutes = 29;
  assert.throws(() => assertTeachingProgram(input), /exatamente 60 minutos/);
});

void it("rejects content after the final assessment and assessments attached to another unit", () => {
  const input = programInput("00000000-0000-0000-0000-000000000001");
  input.activities[3]!.kind = "REVIEW";
  input.activities[3]!.assessmentKey = null;
  assert.throws(() => assertTeachingProgram(input), /terminar com sua prova/);
  input.activities[3]!.kind = "ASSESSMENT";
  input.activities[3]!.assessmentKey = "test-1";
  input.assessments[0]!.unitKey = "missing-unit";
  assert.throws(() => assertTeachingProgram(input), /Prova sem unidade correspondente/);
});
