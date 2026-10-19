import assert from "node:assert/strict";
import { it } from "node:test";
import type { ClassRecordSnapshot } from "@lazuli/validators";
import { contentForPlan } from "../../src/stage-planning/records.js";

const content = {
  kind: "CONTENT" as const,
  account: "Prática de perguntas",
  reference: "Livro",
  pageFrom: 4,
  pageTo: 5,
};
const snapshot: ClassRecordSnapshot = {
  note: null,
  sharedContent: { ...content, account: "Conteúdo coletivo" },
  sharedPlanned: null,
  entries: [
    {
      enrollmentId: "enrollment-a",
      studentId: "student-a",
      name: "Ana",
      progressId: "progress-a",
      stage: "Essentials 1",
      status: "PRESENT",
      content,
      planned: null,
    },
    {
      enrollmentId: "enrollment-b",
      studentId: "student-b",
      name: "Bia",
      progressId: "progress-b",
      stage: "Essentials 1",
      status: "PRESENT",
      content: { ...content, account: "Outro relato" },
      planned: null,
    },
  ],
};
void it("selects only the student's current stage record and rejects another stage or student", () => {
  assert.deepEqual(
    contentForPlan(
      snapshot,
      { student: { id: "student-a", fullName: "Ana" }, progressId: "progress-a" },
      "plan-a",
    ),
    content,
  );
  assert.equal(
    contentForPlan(
      snapshot,
      { student: { id: "student-a", fullName: "Ana" }, progressId: "progress-b" },
      "plan-a",
    ),
    null,
  );
  assert.equal(
    contentForPlan(
      { ...snapshot, entries: snapshot.entries.map((entry) => ({ ...entry, status: "ABSENT" })) },
      { student: { id: "student-a", fullName: "Ana" }, progressId: "progress-a" },
      "plan-a",
    ),
    null,
  );
});
void it("retains recorded evidence from a transferred enrollment when the same plan follows the student", () => {
  const transferred: ClassRecordSnapshot = {
    ...snapshot,
    entries: [
      {
        ...snapshot.entries[0]!,
        planned: { planId: "plan-a", revisionId: "revision-a", version: 1, items: [] },
      },
    ],
  };
  assert.deepEqual(
    contentForPlan(
      transferred,
      { student: { id: "student-a", fullName: "Ana" }, progressId: "progress-new" },
      "plan-a",
    ),
    content,
  );
  assert.deepEqual(contentForPlan(snapshot, { student: null, progressId: null }, "plan-regular"), {
    ...content,
    account: "Conteúdo coletivo",
  });
});
