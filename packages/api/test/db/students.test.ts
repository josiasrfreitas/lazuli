import assert from "node:assert/strict";
import { after, before, describe } from "node:test";

import { db } from "@lazuli/db";
import { databaseIt } from "@lazuli/db/test";

import {
  ADULT_BIRTH_DATE_OBJECT,
  caller,
  cleanDatabase,
  createAdultFixture,
  MINOR_BIRTH_DATE_OBJECT,
  TEST_PREFIX,
} from "./student-test-support.js";

void describe("students profile aggregate API", () => {
  void before(async () => {
    await db.$connect();
  });

  void after(async () => {
    await cleanDatabase();
    await db.$disconnect();
  });

  registerProfileAggregateTest();
  registerAdultCreateTest();
  registerMinorValidationTest();
  registerMinorGuardianTest();
  registerUpdateContactTest();
});

function registerProfileAggregateTest(): void {
  databaseIt(
    "returns the student profile aggregate with stable empty future sections",
    async () => {
      const student = await createAdultFixture();
      const profile = await caller().students.byId({ id: student.id });

      assert.equal(profile.id, student.id);
      assert.equal(profile.contact.fullName, `${TEST_PREFIX}Profile Adult`);
      assert.equal(profile.contact.phone, "(82) 99999-0000");
      assert.equal(profile.whatsAppUrl, "https://wa.me/5582999990000");
      assert.deepEqual(profile.classes, []);
      assert.deepEqual(profile.attendanceSummary, { semesters: [] });
      assert.deepEqual(profile.finance, {
        openOrders: [],
        installments: [],
        paymentHistory: [],
      });
    },
  );
}

function registerAdultCreateTest(): void {
  databaseIt("creates an adult student with address and reads it through byId", async () => {
    const created = await caller().students.create({
      fullName: `${TEST_PREFIX}Created Adult`,
      phone: "82 98888-0000",
      email: "adult@example.com",
      birthDate: ADULT_BIRTH_DATE_OBJECT,
      documentType: "CPF",
      documentNumber: "12345678900",
      address: {
        street: "Rua GRE-20 Adult",
        number: "123",
        neighborhood: "Centro",
        city: "Maceio",
        state: "AL",
        postalCode: "57000000",
      },
    });

    const profile = await caller().students.byId({ id: created.id });

    assert.equal(profile.contact.fullName, `${TEST_PREFIX}Created Adult`);
    assert.equal(profile.contact.documentType, "CPF");
    assert.equal(profile.address?.street, "Rua GRE-20 Adult");
    assert.equal(profile.guardian, null);
  });
}

function registerMinorValidationTest(): void {
  databaseIt(
    "rejects a minor student without guardian using Portuguese-BR validation",
    async () => {
      await assert.rejects(
        caller().students.create({
          fullName: `${TEST_PREFIX}Minor Without Guardian`,
          birthDate: MINOR_BIRTH_DATE_OBJECT,
        }),
        /Responsavel obrigatorio para alunos menores de idade/,
      );
    },
  );

  databaseIt("rejects a minor guardian without phone or email", async () => {
    await assert.rejects(
      caller().students.create({
        fullName: `${TEST_PREFIX}Minor Guardian Without Contact`,
        birthDate: MINOR_BIRTH_DATE_OBJECT,
        guardian: {
          mode: "create",
          input: {
            fullName: `${TEST_PREFIX}Guardian Without Contact`,
            relationship: "Mae",
          },
        },
      }),
      /Informe telefone ou email do responsavel para alunos menores de idade/,
    );
  });
}

function registerMinorGuardianTest(): void {
  databaseIt("creates a minor with nested guardian sharing the same address", async () => {
    const created = await caller().students.create({
      fullName: `${TEST_PREFIX}Minor With Guardian`,
      birthDate: MINOR_BIRTH_DATE_OBJECT,
      address: {
        street: "Rua GRE-20 Shared",
        number: "45",
        neighborhood: "Farol",
        city: "Maceio",
        state: "AL",
        postalCode: "57000001",
      },
      guardian: {
        mode: "create",
        useStudentAddress: true,
        input: {
          fullName: `${TEST_PREFIX}Guardian Shared`,
          relationship: "Mae",
          phone: "82977770000",
        },
      },
    });

    const profile = await caller().students.byId({ id: created.id });

    assert.equal(profile.guardian?.fullName, `${TEST_PREFIX}Guardian Shared`);
    assert.equal(profile.address?.id, profile.guardian?.address?.id);
  });
}

function registerUpdateContactTest(): void {
  databaseIt(
    "updates contact, address, guardian, and notes through aggregate procedures",
    async () => {
      const created = await createUpdateTarget();

      await caller().students.updateContact({
        id: created.id,
        input: {
          fullName: `${TEST_PREFIX}Updated Target`,
          phone: "82 96666-0000",
          address: {
            street: "Rua GRE-20 Updated",
            city: "Maceio",
            state: "AL",
          },
          guardian: {
            mode: "update",
            input: {
              fullName: `${TEST_PREFIX}Updated Guardian`,
              relationship: "Mae",
              email: "guardian@example.com",
            },
          },
        },
      });
      await caller().students.updateNotes({
        id: created.id,
        notes: "Prefere atendimento por WhatsApp.",
      });

      const profile = await caller().students.byId({ id: created.id });

      assert.equal(profile.contact.fullName, `${TEST_PREFIX}Updated Target`);
      assert.equal(profile.address?.street, "Rua GRE-20 Updated");
      assert.equal(profile.address?.number, "789");
      assert.equal(profile.address?.neighborhood, "Ponta Verde");
      assert.equal(profile.address?.postalCode, "57000002");
      assert.equal(profile.guardian?.fullName, `${TEST_PREFIX}Updated Guardian`);
      assert.equal(profile.guardian?.address?.street, "Rua GRE-20 Guardian Original");
      assert.equal(profile.notes, "Prefere atendimento por WhatsApp.");
    },
  );
}

async function createUpdateTarget(): Promise<{ id: string }> {
  return caller().students.create({
    fullName: `${TEST_PREFIX}Update Target`,
    birthDate: MINOR_BIRTH_DATE_OBJECT,
    address: {
      street: "Rua GRE-20 Original",
      number: "789",
      neighborhood: "Ponta Verde",
      city: "Maceio",
      state: "AL",
      postalCode: "57000002",
    },
    guardian: {
      mode: "create",
      input: {
        fullName: `${TEST_PREFIX}Original Guardian`,
        relationship: "Pai",
        phone: "82911110000",
        address: {
          street: "Rua GRE-20 Guardian Original",
          city: "Maceio",
          state: "AL",
        },
      },
    },
  });
}
