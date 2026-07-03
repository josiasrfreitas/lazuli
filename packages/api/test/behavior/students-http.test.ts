import assert from "node:assert/strict";
import { after, before, describe } from "node:test";

import { db } from "@lazuli/db";
import { databaseIt } from "@lazuli/db/test";

import {
  ADMIN,
  ADULT_BIRTH_DATE,
  callHttpMutation,
  callHttpQuery,
  cleanDatabase,
  HTTP_TEST_PREFIX,
  HTTP_OK,
} from "../db/student-test-support.js";

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
  });
});
