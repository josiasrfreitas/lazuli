import assert from "node:assert/strict";
import type { Prisma } from "@lazuli/db";
import { it } from "node:test";
import { updateStudentContact } from "../../src/students/data.js";

const student = {
  id: "11111111-1111-4111-8111-111111111111",
  fullName: "Ana Souza",
  birthDate: new Date("1990-05-01T00:00:00.000Z"),
  documentType: "RG",
  documentNumber: "1234567",
  phone: "82999990000",
  email: null,
  addressId: null,
  guardianId: null,
};
type Database = Parameters<typeof updateStudentContact>[0]["database"];
function databaseFor(record = student): { database: Database; writes: Prisma.StudentUpdateArgs[] } {
  const writes: Prisma.StudentUpdateArgs[] = [];
  const database = {} as Database;
  Object.assign(database, {
    student: {
      findUnique: () => Promise.resolve(record),
      update: (input: Prisma.StudentUpdateArgs) => {
        writes.push(input);
        return Promise.resolve({ id: record.id });
      },
    },
  });
  return { database, writes };
}

void it("rejects removing the only student contact using the persisted record", async () => {
  const { database, writes } = databaseFor();
  await assert.rejects(
    updateStudentContact({ database, id: student.id, values: { phone: null } }),
    /telefone ou e-mail do aluno/u,
  );
  assert.deepEqual(writes, []);
});

void it("allows replacing the only phone with an email in the same update", async () => {
  const { database, writes } = databaseFor();
  await updateStudentContact({
    database,
    id: student.id,
    values: { phone: null, email: "ana@example.com" },
  });
  assert.deepEqual(writes, [
    { where: { id: student.id }, data: { phone: null, email: "ana@example.com" } },
  ]);
});

void it("rejects clearing the required birth date and document", async () => {
  const { database, writes } = databaseFor();
  await assert.rejects(
    updateStudentContact({ database, id: student.id, values: { birthDate: null } }),
    /nascimento do aluno/u,
  );
  await assert.rejects(
    updateStudentContact({ database, id: student.id, values: { documentNumber: null } }),
    /CPF ou RG do aluno/u,
  );
  assert.deepEqual(writes, []);
});

void it("automatically requires a guardian when an updated birth date makes the student a minor", async () => {
  const { database, writes } = databaseFor();
  await assert.rejects(
    updateStudentContact({ database, id: student.id, values: { birthDate: new Date() } }),
    /Responsavel obrigatorio/u,
  );
  assert.deepEqual(writes, []);
});
