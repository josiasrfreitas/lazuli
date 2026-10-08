import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import { db } from "@lazuli/db";

import { gre30Enrollment } from "../support/enrollment.js";

const {
  ADMIN,
  callHttpMutation,
  cleanDatabase: cleanEnrollmentDatabase,
  createPersonalizedClass,
  createStudent,
  ensureTeacherUser,
  HTTP_OK,
  seedCatalog,
} = gre30Enrollment;

type CreateResponseBody = {
  result: { data: { json: { orderPromptRequired: boolean; enrollment: { id: string } } } };
};

void describe("enrollment API over the tRPC HTTP boundary", () => {
  void before(async () => {
    await db.$connect();
  });
  void beforeEach(async () => {
    await cleanEnrollmentDatabase();
  });
  void after(async () => {
    await cleanEnrollmentDatabase();
    await db.$disconnect();
  });

  void it("creates an enrollment and its active progress via HTTP", async () => {
    await ensureTeacherUser();
    const catalog = await seedCatalog();
    const classRow = await createPersonalizedClass({
      code: "http",
      semesterId: catalog.semesterId,
    });
    const student = await createStudent({ suffix: "Http Student" });

    const response = await callHttpMutation({
      path: "enrollment.create",
      staffUser: ADMIN,
      body: { studentId: student.id, classId: classRow.id, stageId: catalog.activeStageId },
    });
    const payload = (await response.json()) as CreateResponseBody;

    assert.equal(response.status, HTTP_OK);
    assert.equal(payload.result.data.json.orderPromptRequired, true);
  });

  void it("serializes a future pause and keeps the enrollment open until its date", async () => {
    await ensureTeacherUser();
    const catalog = await seedCatalog();
    const classRow = await createPersonalizedClass({
      code: "http-pause",
      semesterId: catalog.semesterId,
    });
    const student = await createStudent({ suffix: "Http Pause" });
    const created = await callHttpMutation({
      path: "enrollment.create",
      staffUser: ADMIN,
      body: { studentId: student.id, classId: classRow.id, stageId: catalog.activeStageId },
    });
    const payload = (await created.json()) as CreateResponseBody;
    assert.equal(created.status, HTTP_OK);

    const response = await callHttpMutation({
      path: "enrollment.close",
      staffUser: ADMIN,
      body: {
        enrollmentId: payload.result.data.json.enrollment.id,
        reason: "SUSPENDED",
        effectiveDate: "2099-01-01T00:00:00.000Z",
      },
    });

    assert.equal(response.status, HTTP_OK);
    const enrollment = await db.enrollment.findUniqueOrThrow({
      where: { id: payload.result.data.json.enrollment.id },
    });
    assert.equal(enrollment.exitDate, null);
    assert.equal(
      await db.enrollmentAction.count({
        where: { enrollmentId: payload.result.data.json.enrollment.id, status: "SCHEDULED" },
      }),
      1,
    );
  });
});
