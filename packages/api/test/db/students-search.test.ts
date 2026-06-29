import assert from "node:assert/strict";
import { after, before, describe } from "node:test";

import { db } from "@lazuli/db";
import { databaseIt } from "@lazuli/db/test";

import { ADULT_BIRTH_DATE_OBJECT, caller, cleanDatabase } from "./student-test-support.js";

const SEARCH_TEST_PREFIX = "GRE-21 Search ";

void describe("students search API", () => {
  void before(async () => {
    await db.$connect();
  });

  void after(async () => {
    await cleanDatabase(SEARCH_TEST_PREFIX);
    await db.$disconnect();
  });

  registerSearchByNameTest();
  registerSearchByDocumentTest();
  registerSearchByContactTest();
  registerSearchValidationTest();
});

function registerSearchByNameTest(): void {
  databaseIt("finds students by partial name with ranked matches", async () => {
    const exactPrefix = await caller().students.create({
      fullName: `${SEARCH_TEST_PREFIX}Ana Clara`,
      birthDate: ADULT_BIRTH_DATE_OBJECT,
    });
    await caller().students.create({
      fullName: `${SEARCH_TEST_PREFIX}Mariana`,
      birthDate: ADULT_BIRTH_DATE_OBJECT,
    });

    const results = await caller().students.search({ query: "Ana" });

    assert.equal(results[0]?.id, exactPrefix.id);
    assert.equal(results[0]?.fullName, `${SEARCH_TEST_PREFIX}Ana Clara`);
    assert.equal(results[1]?.fullName, `${SEARCH_TEST_PREFIX}Mariana`);
  });
}

function registerSearchByDocumentTest(): void {
  databaseIt("finds students by partial document number", async () => {
    const target = await caller().students.create({
      fullName: `${SEARCH_TEST_PREFIX}Document Target`,
      birthDate: ADULT_BIRTH_DATE_OBJECT,
      documentType: "CPF",
      documentNumber: "21654987000",
    });
    await caller().students.create({
      fullName: `${SEARCH_TEST_PREFIX}Document Other`,
      birthDate: ADULT_BIRTH_DATE_OBJECT,
      documentType: "CPF",
      documentNumber: "11333777999",
    });

    const results = await caller().students.search({ query: "654987" });

    assert.equal(results[0]?.id, target.id);
    assert.equal(results[0]?.fullName, `${SEARCH_TEST_PREFIX}Document Target`);
  });
}

function registerSearchByContactTest(): void {
  databaseIt("finds students by phone and email fragments", async () => {
    const phoneTarget = await caller().students.create({
      fullName: `${SEARCH_TEST_PREFIX}Phone Target`,
      birthDate: ADULT_BIRTH_DATE_OBJECT,
      phone: "82 98765-4321",
    });
    const emailTarget = await caller().students.create({
      fullName: `${SEARCH_TEST_PREFIX}Email Target`,
      birthDate: ADULT_BIRTH_DATE_OBJECT,
      email: "search-target@example.com",
    });

    const phoneResults = await caller().students.search({ query: "8765" });
    const emailResults = await caller().students.search({ query: "target@example" });

    assert.equal(phoneResults[0]?.id, phoneTarget.id);
    assert.equal(emailResults[0]?.id, emailTarget.id);
  });
}

function registerSearchValidationTest(): void {
  databaseIt("rejects a blank search query", async () => {
    await assert.rejects(caller().students.search({ query: "   " }), /Campo obrigatorio/);
  });
}
