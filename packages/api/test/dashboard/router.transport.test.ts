import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { db } from "@lazuli/db";

import {
  ADMIN,
  HTTP_FORBIDDEN,
  HTTP_OK,
  TEACHER,
  callHttpQuery,
  cleanDashboardDatabase,
  ensureDashboardUsers,
  seedClass,
  seedDashboardCatalog,
  seedSession,
} from "../support/dashboard-test-support.js";

const NOW = new Date("2084-03-10T15:00:00.000Z");

void describe("dashboard HTTP behavior", { concurrency: false }, () => {
  void before(async () => {
    await db.$connect();
  });

  void after(async () => {
    await cleanDashboardDatabase();
    await db.$disconnect();
  });

  void it("serves dashboard queries through the HTTP adapter with role gates", async () => {
    await cleanDashboardDatabase();
    await ensureDashboardUsers();
    const { stageId, semesterId } = await seedDashboardCatalog();
    const classId = await seedClass({
      code: "HTTP",
      teacherId: TEACHER.id,
      semesterId,
      stageId,
    });
    await seedSession({ classId, date: "2084-03-10" });

    const adminResponse = await callHttpQuery({
      path: "dashboard.adminMetrics",
      staffUser: ADMIN,
      now: NOW,
    });
    const teacherResponse = await callHttpQuery({
      path: "dashboard.teacherHome",
      staffUser: TEACHER,
      now: NOW,
    });
    const forbiddenResponse = await callHttpQuery({
      path: "dashboard.adminMetrics",
      staffUser: TEACHER,
      now: NOW,
    });

    assert.equal(adminResponse.status, HTTP_OK);
    assert.equal(teacherResponse.status, HTTP_OK);
    assert.equal(forbiddenResponse.status, HTTP_FORBIDDEN);

    const teacherPayload = (await teacherResponse.json()) as {
      result: { data: { json: { todaySessions: Array<{ classId: string }> } } };
    };

    assert.equal(Array.isArray(teacherPayload.result.data.json.todaySessions), true);
  });
});
