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
} from "../db/calendar-test-support.js";

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

  databaseIt("admin imports holidays over the HTTP adapter", async () => {
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
  });

  databaseIt("teacher and anonymous callers are rejected by the procedure gates", async () => {
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
  });
});
