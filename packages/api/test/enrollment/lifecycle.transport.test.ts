import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  gre32LifecycleHttpEnrollment,
  type TwoStageCatalog as TwoStageCatalogFixture,
} from "../support/enrollment.js";

const {
  ADMIN,
  callHttpMutation,
  createPersonalizedClass,
  createRegularClass,
  createStudent,
  enrollPersonalized,
  enrollRegular,
  ensureTeacherUser,
  HTTP_OK,
  registerLifecycleDbLifecycle,
  seedTwoStageCatalog,
} = gre32LifecycleHttpEnrollment;

type CloseResponseBody = {
  result: { data: { json: { enrollmentId: string; exitReason: string } } };
};

type TransferResponseBody = {
  result: { data: { json: { enrollment: { id: string }; progress: { stageId: string } } } };
};

async function setup(): Promise<TwoStageCatalogFixture> {
  await ensureTeacherUser();
  return seedTwoStageCatalog();
}

void describe("enrollment lifecycle over the tRPC HTTP boundary", () => {
  registerLifecycleDbLifecycle();

  registerCloseHttp();
  registerTransferHttp();
});

function registerCloseHttp(): void {
  void it("closes an enrollment and persists the drop via HTTP", async () => {
    const catalog = await setup();
    const classRow = await createPersonalizedClass({
      code: "http-close",
      semesterId: catalog.semesterId,
    });
    const student = await createStudent("Http Close Student");
    const enrollmentId = await enrollPersonalized({
      studentId: student.id,
      classId: classRow.id,
      stageId: catalog.firstStageId,
    });

    const response = await callHttpMutation({
      path: "enrollment.close",
      staffUser: ADMIN,
      body: { enrollmentId, reason: "DROPPED" },
    });
    const payload = (await response.json()) as CloseResponseBody;

    assert.equal(response.status, HTTP_OK);
    assert.equal(payload.result.data.json.exitReason, "DROPPED");
  });
}

function registerTransferHttp(): void {
  void it("transfers between classes and persists both sides via HTTP", async () => {
    const catalog = await setup();
    const source = await createRegularClass({
      code: "http-src",
      sharedStageId: catalog.firstStageId,
      semesterId: catalog.semesterId,
    });
    const target = await createRegularClass({
      code: "http-dst",
      sharedStageId: catalog.secondStageId,
      semesterId: catalog.semesterId,
    });
    const student = await createStudent("Http Transfer Student");
    const enrollmentId = await enrollRegular({ studentId: student.id, classId: source.id });

    const response = await callHttpMutation({
      path: "enrollment.transfer",
      staffUser: ADMIN,
      body: { enrollmentId, targetClassId: target.id },
    });
    const payload = (await response.json()) as TransferResponseBody;

    assert.equal(response.status, HTTP_OK);
    assert.equal(payload.result.data.json.progress.stageId, catalog.secondStageId);
  });
}
