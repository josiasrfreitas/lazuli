import assert from "node:assert/strict";
import { after, before, describe } from "node:test";

import { config as loadEnvironment } from "dotenv";

import { databaseIt } from "../support/support.js";

loadEnvironment({ path: new URL("../../../../.env", import.meta.url), quiet: true });

const { createDbClient } = await import("../../src/client.js");

const TEST_PREFIX = "GRE-18 ";
const ADULT_BIRTH_DATE = new Date("1990-01-01T00:00:00.000Z");
const MINOR_BIRTH_DATE = new Date("2020-01-01T00:00:00.000Z");

type DatabaseClient = ReturnType<typeof createDbClient>;
type SharedAddressFixture = {
  addressId: string;
  guardianId: string;
  studentId: string;
};

void describe("student contact schema", () => {
  const database = createDbClient();

  void before(async () => {
    await database.$connect();
  });

  void after(async () => {
    await cleanDatabase(database);
    await database.$disconnect();
  });

  databaseIt("creates and reads an adult student without a guardian", () =>
    createAndReadAdultStudent(database),
  );

  databaseIt("rejects a minor student without a guardian", () =>
    rejectMinorStudentWithoutGuardian(database),
  );

  databaseIt("creates a minor student with a guardian", () =>
    createMinorStudentWithGuardian(database),
  );

  databaseIt("lets a student and guardian share an address that can be removed", () =>
    shareAndRemoveAddress(database),
  );

  databaseIt("rejects a student document number without a document type", () =>
    rejectStudentDocumentWithoutType(database),
  );

  databaseIt("rejects a guardian document number without a document type", () =>
    rejectGuardianDocumentWithoutType(database),
  );
});

async function cleanDatabase(database: DatabaseClient): Promise<void> {
  await database.student.deleteMany({
    where: { fullName: { startsWith: TEST_PREFIX } },
  });
  await database.guardian.deleteMany({
    where: { fullName: { startsWith: TEST_PREFIX } },
  });
  await database.address.deleteMany({
    where: { street: { startsWith: "Rua GRE-18" } },
  });
}

async function createAndReadAdultStudent(database: DatabaseClient): Promise<void> {
  const student = await database.student.create({
    data: {
      fullName: `${TEST_PREFIX}Adult Student`,
      birthDate: ADULT_BIRTH_DATE,
    },
  });

  const foundStudent = await database.student.findFirst({
    where: { id: student.id },
  });

  assert.equal(foundStudent?.fullName, `${TEST_PREFIX}Adult Student`);
  assert.equal(foundStudent?.guardianId, null);
}

async function rejectMinorStudentWithoutGuardian(database: DatabaseClient): Promise<void> {
  await expectConstraintRejection(
    database.student.create({
      data: {
        fullName: `${TEST_PREFIX}Minor Without Guardian`,
        birthDate: MINOR_BIRTH_DATE,
      },
    }),
    "Student_minor_requires_guardian_check",
  );
}

async function createMinorStudentWithGuardian(database: DatabaseClient): Promise<void> {
  const guardian = await database.guardian.create({
    data: {
      fullName: `${TEST_PREFIX}Guardian`,
      relationship: "Mae",
      phone: "82999999999",
    },
  });

  const student = await database.student.create({
    data: {
      fullName: `${TEST_PREFIX}Minor With Guardian`,
      birthDate: MINOR_BIRTH_DATE,
      guardianId: guardian.id,
    },
  });

  const foundStudent = await database.student.findFirst({
    include: { guardian: true },
    where: { id: student.id },
  });

  assert.equal(foundStudent?.guardian?.fullName, `${TEST_PREFIX}Guardian`);
}

async function shareAndRemoveAddress(database: DatabaseClient): Promise<void> {
  const fixture = await createSharedAddressFixture(database);

  const sharedAddress = await database.address.findFirst({
    include: { guardians: true, students: true },
    where: { id: fixture.addressId },
  });

  assert.equal(sharedAddress?.students[0]?.id, fixture.studentId);
  assert.equal(sharedAddress?.guardians[0]?.id, fixture.guardianId);

  await database.address.delete({ where: { id: fixture.addressId } });
  await expectAddressRemovedFromHolders(database, fixture);
}

async function createSharedAddressFixture(database: DatabaseClient): Promise<SharedAddressFixture> {
  const address = await database.address.create({
    data: {
      street: "Rua GRE-18",
      number: "123",
      neighborhood: "Centro",
      city: "Maceio",
      state: "AL",
      postalCode: "57000000",
    },
  });
  const guardian = await database.guardian.create({
    data: {
      fullName: `${TEST_PREFIX}Guardian With Address`,
      relationship: "Pai",
      phone: "82988888888",
      addressId: address.id,
    },
  });
  const student = await database.student.create({
    data: {
      fullName: `${TEST_PREFIX}Student With Shared Address`,
      birthDate: MINOR_BIRTH_DATE,
      addressId: address.id,
      guardianId: guardian.id,
    },
  });

  return { addressId: address.id, guardianId: guardian.id, studentId: student.id };
}

async function expectAddressRemovedFromHolders(
  database: DatabaseClient,
  fixture: SharedAddressFixture,
): Promise<void> {
  const student = await database.student.findFirst({
    where: { id: fixture.studentId },
  });
  const guardian = await database.guardian.findFirst({
    where: { id: fixture.guardianId },
  });

  assert.equal(student?.addressId, null);
  assert.equal(guardian?.addressId, null);
}

async function rejectStudentDocumentWithoutType(database: DatabaseClient): Promise<void> {
  await expectConstraintRejection(
    database.student.create({
      data: {
        fullName: `${TEST_PREFIX}Student Missing Document Type`,
        documentNumber: "12345678900",
      },
    }),
    "Student_document_number_requires_type_check",
  );
}

async function rejectGuardianDocumentWithoutType(database: DatabaseClient): Promise<void> {
  await expectConstraintRejection(
    database.guardian.create({
      data: {
        fullName: `${TEST_PREFIX}Guardian Missing Document Type`,
        documentNumber: "12345678900",
      },
    }),
    "Guardian_document_number_requires_type_check",
  );
}

async function expectConstraintRejection(
  action: Promise<unknown>,
  constraintName: string,
): Promise<void> {
  await assert.rejects(action, (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal(error.message.includes(constraintName), true);
    return true;
  });
}
