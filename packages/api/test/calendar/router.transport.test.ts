import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, it } from "node:test";
import { db } from "@lazuli/db";
import {
  callHttpMutation,
  cleanCalendarDatabase,
  ensureCalendarUsers,
  HTTP_OK,
  TEACHER,
  TEST_PREFIX,
} from "../support/calendar-test-support.js";
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const change = {
  action: "period",
  name: `${TEST_PREFIX}HTTP 2097.1`,
  from: "2097-02-01",
  through: "2097-06-30",
};
void before(async () => {
  await db.$connect();
});
void after(async () => {
  await cleanCalendarDatabase();
  await db.$disconnect();
});
void it("admin previews a semester and confirms a durable reconciliation request over HTTP", async () => {
  await cleanCalendarDatabase();
  await ensureCalendarUsers();
  const response = await callHttpMutation({
    path: "calendar.academic.changes.preview",
    body: change,
  });
  assert.equal(response.status, HTTP_OK);
  const preview = (await response.json()) as {
    result: { data: { json: { fingerprint: string } } };
  };
  const saved = await callHttpMutation({
    path: "calendar.academic.changes.confirm",
    body: { change, fingerprint: preview.result.data.json.fingerprint, commandId: randomUUID() },
  });
  assert.equal(saved.status, HTTP_OK);
  const result = (await saved.json()) as {
    result: { data: { json: { status: string; semesterId: string } } };
  };
  assert.equal(result.result.data.json.status, "PENDING");
  assert.ok(result.result.data.json.semesterId);
});
void it("teacher and anonymous callers cannot preview or confirm calendar mutations", async () => {
  await cleanCalendarDatabase();
  await ensureCalendarUsers();
  for (const path of ["calendar.academic.changes.preview", "calendar.academic.changes.confirm"]) {
    const body = path.endsWith("preview")
      ? change
      : { change, fingerprint: "0".repeat(64), commandId: randomUUID() };
    assert.equal(
      (await callHttpMutation({ path, body, staffUser: TEACHER })).status,
      HTTP_FORBIDDEN,
    );
    assert.equal(
      (await callHttpMutation({ path, body, staffUser: null })).status,
      HTTP_UNAUTHORIZED,
    );
  }
});
void it("legacy mutation paths cannot bypass the preview", async () => {
  await ensureCalendarUsers();
  for (const path of [
    "calendar.addClosedDay",
    "calendar.removeClosedDay",
    "calendar.importBrazilFederalHolidays",
    "calendar.createSemester",
    "semesterOrganization.closeRange",
    "semesterOrganization.updatePeriod",
  ])
    assert.equal((await callHttpMutation({ path, body: {} })).status, 404);
});
