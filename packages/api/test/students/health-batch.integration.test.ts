import assert from "node:assert/strict";
import { it } from "node:test";
import { db, readStudentHealthBatch } from "@lazuli/db";
import { createCaller } from "@lazuli/api";
import {
  ADMIN,
  NOW,
  PREFIX,
  CLASS_A_CODE,
  caller,
  cleanStudentsListFixture,
  seedStudentsListFixture,
  fullNameOf,
} from "../support/students-list-test-support.js";

void it("loads 25 scores with four bulk reads while preserving profile scores and missing data", async (test) => {
  await cleanStudentsListFixture();
  try {
    await seedStudentsListFixture();
    const classroom = await db.class.findFirstOrThrow({ where: { internalCode: CLASS_A_CODE } });
    const original = await db.student.findMany({
      where: {
        fullName: {
          in: [fullNameOf("Ana Attend"), fullNameOf("Bruno Low"), fullNameOf("Carla NoData")],
        },
      },
      orderBy: { fullName: "asc" },
    });
    const stage = await db.stage.findFirstOrThrow({ where: { name: `${PREFIX}Stage` } });
    const ids = original.map((student) => student.id);
    for (let index = 0; index < 22; index++) {
      const student = await db.student.create({
        data: {
          fullName: `${PREFIX}Batch ${index}`,
          enrollments: {
            create: {
              classId: classroom.id,
              entryDate: new Date("2044-02-01"),
              progressRecords: { create: { stageId: stage.id, startDate: new Date("2044-02-01") } },
            },
          },
        },
      });
      ids.push(student.id);
    }
    const counted = {
      student: { ...db.student, findMany: test.mock.fn(db.student.findMany.bind(db.student)) },
      enrollment: {
        ...db.enrollment,
        findMany: test.mock.fn(db.enrollment.findMany.bind(db.enrollment)),
      },
      classSession: {
        ...db.classSession,
        findMany: test.mock.fn(db.classSession.findMany.bind(db.classSession)),
      },
      pedagogicalOccurrence: {
        ...db.pedagogicalOccurrence,
        findMany: test.mock.fn(db.pedagogicalOccurrence.findMany.bind(db.pedagogicalOccurrence)),
      },
    };
    const readers = [
      counted.student.findMany,
      counted.enrollment.findMany,
      counted.classSession.findMany,
      counted.pedagogicalOccurrence.findMany,
    ];
    const results = await readStudentHealthBatch({ database: counted, ids, now: NOW });
    assert.equal(results.length, 25);
    assert.equal(
      readers.reduce((sum, reader) => sum + reader.mock.callCount(), 0),
      4,
      "student, enrollment, session and occurrence reads must not grow per row",
    );
    const [ana, bruno, carla] = original;
    assert.ok(ana);
    assert.ok(bruno);
    assert.ok(carla);
    // Attendance 75/25, no grades, no occurrences: (attendance * 35 + 100 * 20) / 55.
    assert.equal(results.find((row) => row.studentId === ana.id)?.score, 84);
    assert.equal(results.find((row) => row.studentId === bruno.id)?.score, 52);
    assert.equal(results.find((row) => row.studentId === carla.id)?.score, null);
    for (const student of original) {
      const { studentId, ...batch } = results.find((row) => row.studentId === student.id)!;
      assert.equal(studentId, student.id);
      assert.deepEqual(batch, await caller().students.health({ id: student.id }));
    }
    for (const reader of readers) reader.mock.resetCalls();
    await readStudentHealthBatch({ database: counted, ids: [ana.id], now: NOW });
    assert.equal(
      readers.reduce((sum, reader) => sum + reader.mock.callCount(), 0),
      4,
      "one and 25 students use the same number of read operations",
    );
    await db.student.update({ where: { id: ana.id }, data: { deletedAt: NOW } });
    const filtered = await caller().students.healthBatch({ ids: [ana.id, bruno.id, bruno.id] });
    assert.deepEqual(
      filtered.map((row) => row.studentId),
      [bruno.id],
    );
    assert.deepEqual(await caller().students.healthBatch({ ids: [] }), []);
  } finally {
    await cleanStudentsListFixture();
  }
});

void it("restricts bulk scores to administration and bounds page size", async () => {
  const anonymous = createCaller({ db, staffUser: null, now: NOW });
  const teacher = createCaller({ db, staffUser: { ...ADMIN, role: "TEACHER" }, now: NOW });
  await assert.rejects(anonymous.students.healthBatch({ ids: [] }), { code: "UNAUTHORIZED" });
  await assert.rejects(teacher.students.healthBatch({ ids: [] }), { code: "FORBIDDEN" });
  await assert.rejects(
    caller().students.healthBatch({ ids: Array.from({ length: 51 }, () => ADMIN.id) }),
    { code: "BAD_REQUEST" },
  );
});
