import assert from "node:assert/strict";
import { it } from "node:test";
import type { Prisma } from "@lazuli/db";
import type { RecordSession } from "../../src/class-records/data.js";
import { readPendingLessons } from "../../src/dashboard/home-lessons.js";

void it("uses a three-day cutoff and groups exact seven-day priority by teacher identity", async () => {
  const now = new Date("2026-10-26T19:00:00Z");
  const session = ({
    id,
    date,
    end,
    teacherId,
    confirmed = false,
  }: {
    id: string;
    date: string;
    end: string;
    teacherId: string;
    confirmed?: boolean;
  }): RecordSession => ({
    id,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    classId: teacherId === "teacher-b" ? "other-class" : "class",
    scheduleSlotId: null,
    status: "SCHEDULED",
    cancelReason: null,
    cancelledAt: null,
    cancelledById: null,
    attendanceConfirmedById: null,
    attendanceLastCommittedAt: null,
    portalSubmittedAt: null,
    date: new Date(date),
    endTime: new Date(`1970-01-01T${end}:00Z`),
    startTime: new Date("1970-01-01T14:00:00Z"),
    classRecord: null,
    attendanceConfirmedAt: confirmed ? now : null,
    responsibilityFrozenAt: now,
    usualTeacherId: teacherId,
    class: {
      id: teacherId === "teacher-b" ? "other-class" : "class",
      format: "IN_PERSON",
      scheduleType: teacherId === "teacher-b" ? "PERSONALIZED" : "REGULAR",
      sharedStage: { id: "stage", name: "Teenstation" },
      teacherId,
      portalClassName: "Teens 1",
      substitutions: [],
      teacherAssignments: [],
      teacher: { id: teacherId, name: "Ana", teacherProfile: null },
    },
  });
  let where: Prisma.ClassSessionWhereInput | undefined;
  const database = {
    user: {
      findMany: () =>
        Promise.resolve([
          { id: "teacher-a", name: "Ana", teacherProfile: null },
          { id: "teacher-b", name: "Ana", teacherProfile: null },
        ]),
    },
    classSession: {
      findMany: (args: Prisma.ClassSessionFindManyArgs) => {
        where = args.where;
        return Promise.resolve([
          session({
            id: "high",
            date: "2026-10-19",
            end: "16:00",
            teacherId: "teacher-a",
            confirmed: true,
          }),
          session({ id: "almost-seven", date: "2026-10-19", end: "16:01", teacherId: "teacher-b" }),
          session({ id: "three", date: "2026-10-23", end: "16:00", teacherId: "teacher-a" }),
        ]);
      },
    },
  };
  const result = await readPendingLessons(database, now);
  assert.deepEqual(where, {
    deletedAt: null,
    status: { not: "CANCELLED" },
    classRecord: null,
    class: { deletedAt: null },
    OR: [
      { date: { lt: new Date("2026-10-23") } },
      { date: new Date("2026-10-23"), endTime: { lte: new Date("1970-01-01T16:00:00Z") } },
    ],
  });
  assert.deepEqual(
    result.map((group) => [group.teacherId, group.high, group.low]),
    [
      ["teacher-a", 1, 1],
      ["teacher-b", 0, 1],
    ],
  );
  assert.deepEqual(
    result[0]?.lessons.map((lesson) => [
      lesson.id,
      lesson.classId,
      lesson.ageDays,
      lesson.priority,
    ]),
    [
      ["high", "class", 7, "high"],
      ["three", "class", 3, "low"],
    ],
  );
  assert.equal(result[0]?.lessons[0]?.className, "Teenstation");
  assert.equal(result[1]?.lessons[0]?.className, "PPT");
  assert.deepEqual(result[0]?.lessons[0]?.missing, ["progresso"]);
  assert.deepEqual(result[1]?.lessons[0]?.missing, ["chamada", "progresso"]);
});
