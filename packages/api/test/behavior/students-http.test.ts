import assert from "node:assert/strict";
import { after, before, describe } from "node:test";

import { db } from "@lazuli/db";
import { databaseIt } from "@lazuli/db/test";
import { STUDENT_PAGE_SIZE_OPTIONS } from "@lazuli/validators";

import {
  ADMIN,
  ADULT_BIRTH_DATE,
  callHttpMutation,
  callHttpQuery,
  cleanDatabase,
  HTTP_TEST_PREFIX,
  HTTP_OK,
} from "../db/student-test-support.js";

const EXPANDED_PAGE_SIZE = STUDENT_PAGE_SIZE_OPTIONS[1];

void describe("students API over the tRPC HTTP boundary", () => {
  void before(async () => {
    await db.$connect();
  });

  void after(async () => {
    await cleanDatabase(HTTP_TEST_PREFIX);
    await db.$disconnect();
  });

  databaseIt("creates and reads a student with real HTTP requests", async () => {
    const createResponse = await callHttpMutation({
      path: "students.create",
      staffUser: ADMIN,
      body: {
        fullName: `${HTTP_TEST_PREFIX}Adult`,
        birthDate: ADULT_BIRTH_DATE,
        phone: "82955550000",
      },
    });
    const created = (await createResponse.json()) as { result: { data: { json: { id: string } } } };
    const readResponse = await callHttpQuery({
      path: "students.byId",
      staffUser: ADMIN,
      body: { id: created.result.data.json.id },
    });
    const read = (await readResponse.json()) as {
      result: { data: { json: { contact: { fullName: string }; whatsAppUrl: string } } };
    };

    assert.equal(createResponse.status, HTTP_OK);
    assert.equal(readResponse.status, HTTP_OK);
    assert.equal(read.result.data.json.contact.fullName, `${HTTP_TEST_PREFIX}Adult`);
    assert.equal(read.result.data.json.whatsAppUrl, "https://wa.me/5582955550000");

    const listResponse = await callHttpQuery({
      path: "students.list",
      staffUser: ADMIN,
      body: { search: HTTP_TEST_PREFIX, pageSize: EXPANDED_PAGE_SIZE },
    });
    const list = (await listResponse.json()) as {
      result: {
        data: { json: { page: number; pageCount: number; pageSize: number; total: number } };
      };
    };

    assert.equal(listResponse.status, HTTP_OK);
    assert.equal(list.result.data.json.page, 1);
    assert.equal(list.result.data.json.pageCount, 1);
    assert.equal(list.result.data.json.pageSize, EXPANDED_PAGE_SIZE);
    assert.equal(list.result.data.json.total, 1);
  });
});
