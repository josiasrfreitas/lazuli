import assert from "node:assert/strict";
import { describe } from "node:test";

import { databaseIt } from "@lazuli/db/test";

import {
  ADMIN,
  assertActiveStageAndOpenEnrollment,
  callHttpMutation,
  createPersonalizedClass,
  createStudent,
  enrollAtStage,
  ensureTeacherUser,
  HTTP_OK,
  registerAdvanceDbLifecycle,
  seedTwoStageCatalog,
} from "../support/enrollment-advance-support.js";

type AdvanceResponseBody = {
  result: { data: { json: { enrollmentId: string; progress: { stageId: string } } } };
};

void describe("enrollment.advanceStage over the tRPC HTTP boundary", () => {
  registerAdvanceDbLifecycle();

  databaseIt("advances to the next stage and keeps the enrollment active via HTTP", async () => {
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
    await assertActiveStageAndOpenEnrollment({ enrollmentId, stageId: catalog.secondStageId });
  });
});
