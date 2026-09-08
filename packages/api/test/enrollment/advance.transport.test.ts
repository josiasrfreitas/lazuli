import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { gre31AdvanceEnrollment } from "../support/enrollment.js";

const {
  ADMIN,
  callHttpMutation,
  createPersonalizedClass,
  createStudent,
  enrollAtStage,
  ensureTeacherUser,
  HTTP_OK,
  registerAdvanceDbLifecycle,
  seedTwoStageCatalog,
} = gre31AdvanceEnrollment;

type AdvanceResponseBody = {
  result: { data: { json: { enrollmentId: string; progress: { stageId: string } } } };
};

void describe("enrollment.advanceStage over the tRPC HTTP boundary", () => {
  registerAdvanceDbLifecycle();

  void it("advances to the next stage and keeps the enrollment active via HTTP", async () => {
    await ensureTeacherUser();
    const catalog = await seedTwoStageCatalog();
    const classRow = await createPersonalizedClass("http", catalog.semesterId);
    const student = await createStudent("Http Student");
    const enrollmentId = await enrollAtStage({
      studentId: student.id,
      classId: classRow.id,
      stageId: catalog.firstStageId,
    });

    const response = await callHttpMutation({
      path: "enrollment.advanceStage",
      staffUser: ADMIN,
      body: { enrollmentId },
    });
    const payload = (await response.json()) as AdvanceResponseBody;

    assert.equal(response.status, HTTP_OK);
    assert.equal(payload.result.data.json.progress.stageId, catalog.secondStageId);
  });
});
