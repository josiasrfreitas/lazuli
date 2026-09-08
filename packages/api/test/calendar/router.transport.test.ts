import assert from "node:assert/strict";
import { after, before, describe } from "node:test";

import { db } from "@lazuli/db";
import { databaseIt } from "@lazuli/db/test";

import {
  callHttpMutation,
  cleanCalendarDatabase,
  ensureCalendarUsers,
  HTTP_OK,
  TEACHER,
  TEST_PREFIX,
} from "../support/calendar-test-support.js";
import { recordingSessionsGenerateQueue } from "../support/session-generation-queue-support.js";

const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const FEDERAL_HOLIDAY_COUNT = 9;
const HTTP_IMPORT_YEAR = 2034;
const REJECTED_IMPORT_YEAR = 2035;
const IMPORT_PATH = "calendar.importBrazilFederalHolidays";

void describe("calendar HTTP behavior", () => {
  void before(async () => {
    await db.$connect();
  });

  void after(async () => {
    await cleanCalendarDatabase();
    await db.$disconnect();
  });

  databaseIt("admin imports holidays over the HTTP adapter", importHolidaysOverHttp);

  databaseIt(
    "admin creates a semester and receives an async generation job",
    createSemesterOverHttp,
  );

  databaseIt("teacher and anonymous callers are rejected by the procedure gates", rejectNonAdmins);
});

async function importHolidaysOverHttp(): Promise<void> {
  await cleanCalendarDatabase();
  await ensureCalendarUsers();

  const response = await callHttpMutation({
    path: IMPORT_PATH,
    body: { year: HTTP_IMPORT_YEAR },
  });

  assert.equal(response.status, HTTP_OK);
  const payload = (await response.json()) as {
    result: {
      data: {
        json: {
          year: number;
          imported: number;
          skipped: number;
          holidays: { date: string; reason: string }[];
        };
      };
    };
  };

  assert.equal(payload.result.data.json.year, HTTP_IMPORT_YEAR);
  assert.equal(payload.result.data.json.imported, FEDERAL_HOLIDAY_COUNT);
  assert.equal(payload.result.data.json.skipped, 0);
  assert.equal(payload.result.data.json.holidays[0]?.date, "2034-01-01");
}

async function createSemesterOverHttp(): Promise<void> {
  await cleanCalendarDatabase();
  await ensureCalendarUsers();
  const queue = recordingSessionsGenerateQueue("job-calendar");

  const response = await callHttpMutation({
    path: "calendar.createSemester",
    body: {
      name: `${TEST_PREFIX}HTTP 2097.1`,
      startDate: "2097-02-01",
      endDate: "2097-06-30",
    },
    queue,
  });

  assert.equal(response.status, HTTP_OK);
  const payload = (await response.json()) as CreateSemesterPayload;

  assert.equal(payload.result.data.json.semester.name, `${TEST_PREFIX}HTTP 2097.1`);
  assert.equal(payload.result.data.json.sessionsGenerateJob.workflowName, "sessions-generate");
  assert.deepEqual(queue.calls, [{ semesterId: payload.result.data.json.semester.id }]);
}

async function rejectNonAdmins(): Promise<void> {
  await cleanCalendarDatabase();
  await ensureCalendarUsers();

  const teacherResponse = await callHttpMutation({
    path: IMPORT_PATH,
    body: { year: REJECTED_IMPORT_YEAR },
    staffUser: TEACHER,
  });
  const anonymousResponse = await callHttpMutation({
    path: IMPORT_PATH,
    body: { year: REJECTED_IMPORT_YEAR },
    staffUser: null,
  });

  assert.equal(teacherResponse.status, HTTP_FORBIDDEN);
  assert.equal(anonymousResponse.status, HTTP_UNAUTHORIZED);
}

type CreateSemesterPayload = {
  result: {
    data: {
      json: {
        semester: { id: string; name: string };
        sessionsGenerateJob: { workflowName: string };
      };
    };
  };
};
