import assert from "node:assert/strict";
import { after, beforeEach, it } from "node:test";
import { db } from "@lazuli/db";
import {
  PREFIX,
  NOW,
  CLASS_A_CODE,
  TEACHER_A_NAME,
  TEACHER_B_NAME,
  caller,
  cleanStudentsListFixture,
  seedStudentsListFixture,
  fullNameOf,
} from "../support/students-list-test-support.js";

async function clean() {
  await db.classTeacherAssignment.deleteMany({
    where: { class: { internalCode: { startsWith: PREFIX } } },
  });
  await db.teacherProfile.deleteMany({
    where: { user: { name: { in: [TEACHER_A_NAME, TEACHER_B_NAME] } } },
  });
  await db.user.updateMany({
    where: { name: { in: [TEACHER_A_NAME, TEACHER_B_NAME] } },
    data: { deletedAt: null },
  });
  await cleanStudentsListFixture();
}
beforeEach(async () => {
  await clean();
  await seedStudentsListFixture();
});
after(async () => {
  await clean();
  await db.$disconnect();
});

async function teachers() {
  const group = await db.class.findFirstOrThrow({ where: { internalCode: CLASS_A_CODE } });
  const replacement = await db.user.findFirstOrThrow({ where: { name: TEACHER_B_NAME } });
  return { group, replacement };
}

async function assertTeacher(date: Date, expected: string) {
  const result = await caller(date).students.list({ search: fullNameOf("Ana Attend") });
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0]!.enrollment?.teacherName, expected);
  const preview = await caller(date).students.preview({ id: result.rows[0]!.id });
  assert.equal(preview.enrollment?.teacherName, expected);
  assert.deepEqual(preview, result.rows[0]);
}

void it("selects only the latest effective assignment, including the business day boundary", async () => {
  const { group, replacement } = await teachers();
  await db.classTeacherAssignment.create({
    data: {
      classId: group.id,
      teacherId: replacement.id,
      effectiveDate: new Date("2044-04-16"),
    },
  });
  await assertTeacher(new Date("2044-04-16T02:59:59.999Z"), TEACHER_A_NAME);
  await assertTeacher(new Date("2044-04-16T03:00:00Z"), TEACHER_B_NAME);
  await db.classTeacherAssignment.create({
    data: {
      classId: group.id,
      teacherId: group.teacherId,
      effectiveDate: new Date("2044-04-17"),
    },
  });
  await assertTeacher(new Date("2044-04-17T12:00:00Z"), TEACHER_A_NAME);
});

void it("does not fall back to the original teacher when the effective teacher has left or was removed", async () => {
  const { group, replacement } = await teachers();
  await db.classTeacherAssignment.create({
    data: {
      classId: group.id,
      teacherId: replacement.id,
      effectiveDate: new Date("2044-04-01"),
    },
  });
  await db.teacherProfile.create({
    data: { userId: replacement.id, departureDate: new Date("2044-04-15") },
  });
  await assertTeacher(new Date("2044-04-15T02:59:59.999Z"), TEACHER_B_NAME);
  await assertTeacher(NOW, "Sem professor");
  await db.teacherProfile.update({
    where: { userId: replacement.id },
    data: { departureDate: null },
  });
  await db.user.update({ where: { id: replacement.id }, data: { deletedAt: NOW } });
  await assertTeacher(NOW, "Sem professor");
});

void it("ignores deleted and superseded assignments while preserving the current teacher", async () => {
  const { group, replacement } = await teachers();
  await db.classTeacherAssignment.create({
    data: {
      classId: group.id,
      teacherId: replacement.id,
      effectiveDate: new Date("2044-04-01"),
      supersededAt: NOW,
    },
  });
  const assignment = await db.classTeacherAssignment.create({
    data: {
      classId: group.id,
      teacherId: replacement.id,
      effectiveDate: new Date("2044-04-10"),
      deletedAt: NOW,
    },
  });
  await assertTeacher(NOW, TEACHER_A_NAME);
  await db.classTeacherAssignment.update({
    where: { id: assignment.id },
    data: { deletedAt: null },
  });
  await assertTeacher(NOW, TEACHER_B_NAME);
});

void it("exposes current membership to the header without needing the pedagogy read", async () => {
  const ana = await db.student.findFirstOrThrow({ where: { fullName: fullNameOf("Ana Attend") } });
  const davi = await db.student.findFirstOrThrow({
    where: { fullName: fullNameOf("Davi NoClass") },
  });
  assert.equal((await caller().students.byId({ id: ana.id })).hasCurrentEnrollment, true);
  assert.equal((await caller().students.byId({ id: davi.id })).hasCurrentEnrollment, false);
  const enrollment = await db.enrollment.findFirstOrThrow({ where: { studentId: ana.id } });
  await db.$transaction(async (database) => {
    await database.pedagogicalProgress.updateMany({
      where: { enrollmentId: enrollment.id, endDate: null },
      data: { endDate: new Date("2044-04-15"), endReason: "DROPPED" },
    });
    await database.enrollment.update({
      where: { id: enrollment.id },
      data: { exitDate: new Date("2044-04-15"), exitReason: "DROPPED" },
    });
  });
  assert.equal(
    (await caller(new Date("2044-04-15T02:59:59.999Z")).students.byId({ id: ana.id }))
      .hasCurrentEnrollment,
    true,
  );
  assert.equal(
    (await caller(new Date("2044-04-15T03:00:00Z")).students.byId({ id: ana.id }))
      .hasCurrentEnrollment,
    false,
  );
});
