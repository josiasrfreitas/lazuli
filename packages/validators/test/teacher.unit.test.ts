import assert from "node:assert/strict";
import { test } from "node:test";
import { teacherCreateInputSchema, teacherFileUploadSchema } from "../src/teacher.js";
const identity = { name: "Maria Docente", cpf: "52998224725", email: "maria@example.test" };
void test("registration omits legacy workload and vacation fields", () => {
  assert.equal(
    teacherCreateInputSchema.parse({ ...identity, notes: "  Turno da tarde  " }).notes,
    "Turno da tarde",
  );
  for (const field of ["weeklyHours", "vacationStart", "vacationEnd"])
    assert.equal(teacherCreateInputSchema.safeParse({ ...identity, [field]: null }).success, false);
});
void test("custom attachments require a label and photo uploads reject PDFs", () => {
  const input = {
    teacherId: "bb799218-cdc5-4b20-a7bf-af166981d699",
    kind: "OTHER",
    label: "Diploma",
    fileName: "diploma.pdf",
    contentType: "application/pdf",
    byteLength: 100,
  };
  assert.equal(teacherFileUploadSchema.parse(input).label, "Diploma");
  assert.equal(teacherFileUploadSchema.safeParse({ ...input, label: " " }).success, false);
  assert.equal(teacherFileUploadSchema.safeParse({ ...input, kind: "PHOTO" }).success, false);
  assert.equal(teacherFileUploadSchema.safeParse({ ...input, byteLength: 5242881 }).success, false);
});
