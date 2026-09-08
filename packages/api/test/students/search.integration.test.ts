import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";

import { db } from "@lazuli/db";

import { ADULT_BIRTH_DATE_OBJECT, caller, cleanDatabase } from "../support/student-test-support.js";

// `students.search` is intentionally global (single-school app, no tenant scope) and returns the top 10
// across every student. So parallel-safe assertions must query on unique nonce tokens that no other test
// fixture can match — never natural fragments like "Ana", which other suites also seed and which would
// pollute the ranking under a parallel run.
const SEARCH_TEST_PREFIX = "GRE-21 Search ";
const RANK_TOKEN = "Zylkqx";
const EMAIL_TOKEN = "qwbnonce";
const DOCUMENT_TOKEN = "4273158";
const PHONE_TOKEN = "6688-11";

void describe("students search API", () => {
  void before(async () => {
    await db.$connect();
  });

  void beforeEach(async () => {
    await cleanDatabase(SEARCH_TEST_PREFIX);
  });

  void after(async () => {
    await cleanDatabase(SEARCH_TEST_PREFIX);
    await db.$disconnect();
  });

  registerSearchByNameTest();
  registerSearchByDocumentTest();
  registerSearchByContactTest();
});

function registerSearchByNameTest(): void {
  void it("finds students by partial name with ranked matches", async () => {
    // Word-initial token → rank 500; mid-word token → rank 400. The unique token guarantees these are
    // the only two matches, so the 500-over-400 ordering holds regardless of other students in the DB.
    const wordStart = await caller().students.create({
      fullName: `${SEARCH_TEST_PREFIX}${RANK_TOKEN} Prime`,
      birthDate: ADULT_BIRTH_DATE_OBJECT,
    });
    await caller().students.create({
      fullName: `${SEARCH_TEST_PREFIX}Ma${RANK_TOKEN.toLowerCase()}a`,
      birthDate: ADULT_BIRTH_DATE_OBJECT,
    });

    const results = await caller().students.search({ query: RANK_TOKEN });

    assert.equal(results[0]?.id, wordStart.id);
    assert.equal(results[0]?.fullName, `${SEARCH_TEST_PREFIX}${RANK_TOKEN} Prime`);
    assert.equal(results[1]?.fullName, `${SEARCH_TEST_PREFIX}Ma${RANK_TOKEN.toLowerCase()}a`);
  });
}

function registerSearchByDocumentTest(): void {
  void it("finds students by partial document number", async () => {
    const target = await caller().students.create({
      fullName: `${SEARCH_TEST_PREFIX}Document Target`,
      birthDate: ADULT_BIRTH_DATE_OBJECT,
      documentType: "CPF",
      documentNumber: `900${DOCUMENT_TOKEN}88`,
    });
    await caller().students.create({
      fullName: `${SEARCH_TEST_PREFIX}Document Other`,
      birthDate: ADULT_BIRTH_DATE_OBJECT,
      documentType: "CPF",
      documentNumber: "90019955477",
    });

    const results = await caller().students.search({ query: DOCUMENT_TOKEN });

    assert.equal(results[0]?.id, target.id);
    assert.equal(results[0]?.fullName, `${SEARCH_TEST_PREFIX}Document Target`);
  });
}

function registerSearchByContactTest(): void {
  void it("finds students by phone and email fragments", async () => {
    const phoneTarget = await caller().students.create({
      fullName: `${SEARCH_TEST_PREFIX}Phone Target`,
      birthDate: ADULT_BIRTH_DATE_OBJECT,
      phone: `82 9${PHONE_TOKEN}22`,
    });
    const emailTarget = await caller().students.create({
      fullName: `${SEARCH_TEST_PREFIX}Email Target`,
      birthDate: ADULT_BIRTH_DATE_OBJECT,
      email: `${EMAIL_TOKEN}@example.com`,
    });

    const phoneResults = await caller().students.search({ query: PHONE_TOKEN });
    const emailResults = await caller().students.search({ query: EMAIL_TOKEN });

    assert.equal(phoneResults[0]?.id, phoneTarget.id);
    assert.equal(emailResults[0]?.id, emailTarget.id);
  });
}
