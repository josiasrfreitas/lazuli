import assert from "node:assert/strict";
import { it } from "node:test";
import { assertTeachingProgram, type TeachingProgramImport } from "../src/teaching-program.js";

const program: TeachingProgramImport = {
  stageId: "stage",
  source: { provider: "catalog", reference: "book", revision: "1" },
  scheduleType: "REGULAR",
  modality: { code: "WEEKLY_2H", name: "2 horas por semana", weeklyMinutes: 120 },
  lessons: [{ key: "lesson", sequence: 1, title: "Lesson 1" }],
  units: [{ key: "unit", sequence: 1, title: "Unit 1" }],
  teachingHours: [{ key: "hour", sequence: 1, durationMinutes: 60 }],
  assessments: [{ key: "assessment", unitKey: "unit", sequence: 1, title: "Assessment" }],
  activities: [
    {
      key: "lesson-activity",
      unitKey: "unit",
      teachingHourKey: "hour",
      sequence: 1,
      durationMinutes: 30,
      kind: "LESSON",
      title: "Book activity",
      sourceCode: null,
      descriptionPending: false,
      assessmentKey: null,
      lessons: [{ key: "lesson", part: null }],
    },
    {
      key: "assessment-activity",
      unitKey: "unit",
      teachingHourKey: "hour",
      sequence: 2,
      durationMinutes: 30,
      kind: "ASSESSMENT",
      title: "Assessment",
      sourceCode: null,
      descriptionPending: false,
      assessmentKey: "assessment",
      lessons: [],
    },
  ],
};

void it("accepts a complete teaching hour ending in its unit assessment without changing the imported graph", () => {
  const input = structuredClone(program);
  assertTeachingProgram(input);
  assert.deepEqual(input, program);
});

void it("rejects dangling book references, partial teaching hours and units that do not end in assessment", () => {
  const lesson = program.activities[0]!;
  const assessment = program.activities[1]!;
  assert.throws(
    () =>
      assertTeachingProgram({
        ...program,
        activities: [{ ...lesson, lessons: [{ key: "missing", part: null }] }, assessment],
      }),
    /Atividade referencia uma lição desconhecida/u,
  );
  assert.throws(
    () =>
      assertTeachingProgram({
        ...program,
        teachingHours: [{ key: "hour", sequence: 1, durationMinutes: 30 }],
      }),
    /Cada hora-aula deve conter exatamente 60 minutos/u,
  );
  assert.throws(
    () =>
      assertTeachingProgram({
        ...program,
        activities: [lesson, { ...assessment, kind: "ACTIVITY", assessmentKey: null }],
      }),
    /Cada unidade deve terminar com sua prova/u,
  );
});
