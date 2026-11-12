import assert from "node:assert/strict";
import { test } from "node:test";
import { teacherCreateInputSchema, teacherFileUploadSchema } from "../src/teacher.js";
const identity = { name: "Maria Docente", cpf: "52998224725", email: "maria@example.test" };
void test("teacher registration accepts fractional weekly teaching hours and a CLT vacation period", () => {
  const value = teacherCreateInputSchema.parse({
    ...identity,
    employmentType: "CLT",
    weeklyHours: 20.5,
    vacationStart: "2027-01-10",
    vacationEnd: "2027-01-25",
    notes: "  Turno da tarde  ",
  });
  assert.equal(value.weeklyHours, 20.5);
  assert.equal(value.notes, "Turno da tarde");
  assert.equal(value.vacationStart, "2027-01-10");
});
for (const [name, values, field] of [
  ["nonpositive workload", { weeklyHours: 0 }, "weeklyHours"],
  ["excessive workload", { weeklyHours: 169 }, "weeklyHours"],
  [
    "inverted vacation",
    { employmentType: "CLT", vacationStart: "2027-01-20", vacationEnd: "2027-01-10" },
    "vacationEnd",
  ],
  ["incomplete vacation", { employmentType: "CLT", vacationStart: "2027-01-20" }, "vacationEnd"],
  [
    "vacation for non CLT",
    { employmentType: "PJ", vacationStart: "2027-01-10", vacationEnd: "2027-01-20" },
    "employmentType",
  ],
] as const) {
  void test(`teacher registration rejects ${name}`, () => {
    const result = teacherCreateInputSchema.safeParse({ ...identity, ...values });
    assert.equal(result.success, false);
    if (!result.success)
      assert.equal(
        result.error.issues.some((issue) => issue.path[0] === field),
        true,
      );
  });
}
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
