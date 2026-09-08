import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { config as loadEnvironment } from "dotenv";
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
  registerSchemaTest1(database);
  registerSchemaTest2(database);
  registerSchemaTest3(database);
  registerSchemaTest4(database);
  registerSchemaTest5(database);
  registerSchemaTest6(database);
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
async function createAdultStudentWithoutGuardian(database: DatabaseClient): Promise<string | null> {
  const student = await database.student.create({
    data: {
      fullName: `${TEST_PREFIX}Adult Student`,
      birthDate: ADULT_BIRTH_DATE,
    },
  });
  return student.guardianId;
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
async function expectConstraintRejection(
  action: Promise<unknown>,
  constraintName: string,
): Promise<string> {
  let observedMessage: string | undefined;
  await assert.rejects(action, (error: unknown) => {
    assert.ok(error instanceof Error);
    observedMessage = error.message;
    assert.equal(error.message.includes(constraintName), true);
    return true;
  });
  assert.notEqual(observedMessage, undefined);
  return observedMessage as string;
}
function registerSchemaTest1(database: DatabaseClient): void {
  void it("allows an adult student without a guardian", async () => {
    const guardianId = await createAdultStudentWithoutGuardian(database);
    assert.equal(guardianId, null);
  });
}
function registerSchemaTest2(database: DatabaseClient): void {
  void it("rejects a minor student without a guardian", async () => {
    const observedConstraint1 = await expectConstraintRejection(
      database.student.create({
        data: {
          fullName: `${TEST_PREFIX}Minor Without Guardian`,
          birthDate: MINOR_BIRTH_DATE,
        },
      }),
      "Student_minor_requires_guardian_check",
    );
    assert.equal(observedConstraint1.includes("Student_minor_requires_guardian_check"), true);
  });
}
function registerSchemaTest3(database: DatabaseClient): void {
  void it("creates a minor student with a guardian", async () => {
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
  });
}
function registerSchemaTest4(database: DatabaseClient): void {
  void it("lets a student and guardian share an address that can be removed", async () => {
    const fixture = await createSharedAddressFixture(database);
    const sharedAddress = await database.address.findFirst({
      include: { guardians: true, students: true },
      where: { id: fixture.addressId },
    });
    assert.equal(sharedAddress?.students[0]?.id, fixture.studentId);
    assert.equal(sharedAddress?.guardians[0]?.id, fixture.guardianId);
    await database.address.delete({ where: { id: fixture.addressId } });
    await expectAddressRemovedFromHolders(database, fixture);
  });
}
function registerSchemaTest5(database: DatabaseClient): void {
  void it("rejects a student document number without a document type", async () => {
    const observedConstraint2 = await expectConstraintRejection(
      database.student.create({
        data: {
          fullName: `${TEST_PREFIX}Student Missing Document Type`,
          documentNumber: "12345678900",
        },
      }),
      "Student_document_number_requires_type_check",
    );
    assert.equal(observedConstraint2.includes("Student_document_number_requires_type_check"), true);
  });
}
function registerSchemaTest6(database: DatabaseClient): void {
  void it("rejects a guardian document number without a document type", async () => {
    const observedConstraint3 = await expectConstraintRejection(
      database.guardian.create({
        data: {
          fullName: `${TEST_PREFIX}Guardian Missing Document Type`,
          documentNumber: "12345678900",
        },
      }),
      "Guardian_document_number_requires_type_check",
    );
    assert.equal(
      observedConstraint3.includes("Guardian_document_number_requires_type_check"),
      true,
    );
  });
}
