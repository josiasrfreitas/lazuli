import assert from "node:assert/strict";
import { after, before, it } from "node:test";
import { createCaller } from "@lazuli/api";
import { db } from "@lazuli/db";
import { createEnrollment } from "../../src/enrollment/data.js";
import { cancelScheduledAction } from "../../src/enrollment/scheduled.js";
import { gre30Enrollment } from "../support/enrollment.js";

const {
  ADMIN,
  cleanDatabase,
  createPersonalizedClass,
  createStudent,
  ensureTeacherUser,
  seedCatalog,
} = gre30Enrollment;
function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

void before(async () => {
  await db.$connect();
  await cleanDatabase();
  await ensureTeacherUser();
});
void after(async () => {
  await cleanDatabase();
  await db.$disconnect();
});

void it("serializes cancellation behind an uncommitted future entry and rejects overlapping membership", async () => {
  const catalog = await seedCatalog();
  const sourceClass = await createPersonalizedClass({
    code: "cancel-race-source",
    semesterId: catalog.semesterId,
  });
  const targetClass = await createPersonalizedClass({
    code: "cancel-race-target",
    semesterId: catalog.semesterId,
  });
  const student = await createStudent({ suffix: "Cancellation Race" });
  const now = new Date("2026-09-10T15:00:00Z");
  const caller = createCaller({ db, staffUser: ADMIN, now });
  const source = await caller.enrollment.create({
    studentId: student.id,
    classId: sourceClass.id,
    stageId: catalog.activeStageId,
  });
  await caller.enrollment.close({
    enrollmentId: source.enrollment.id,
    reason: "SUSPENDED",
    effectiveDate: new Date("2026-09-15"),
  });
  const pause = await db.enrollmentAction.findFirstOrThrow({
    where: { enrollmentId: source.enrollment.id, kind: "PAUSE" },
  });
  const inserted = deferred<void>();
  const release = deferred<void>();
  const cancelPid = deferred<number>();
  const creation = db.$transaction(
    async (database) => {
      const result = await createEnrollment({
        database,
        staffUserId: ADMIN.id,
        now,
        values: {
          studentId: student.id,
          classId: targetClass.id,
          stageId: catalog.activeStageId,
          entryDate: new Date("2026-09-20"),
        },
      });
      inserted.resolve();
      await release.promise;
      return result;
    },
    { timeout: 15_000 },
  );
  void creation.catch((error: Error) => inserted.reject(error));
  await inserted.promise;
  const cancellation = db.$transaction(
    async (database) => {
      const [process] = await database.$queryRaw<
        Array<{ pid: number }>
      >`SELECT pg_backend_pid() AS pid`;
      if (!process) throw new Error("Missing cancellation backend PID");
      cancelPid.resolve(process.pid);
      return cancelScheduledAction({ database, actionId: pause.id, staffUserId: ADMIN.id, now });
    },
    { timeout: 15_000 },
  );
  let cancellationFinished = false;
  void cancellation.then(
    () => {
      cancellationFinished = true;
    },
    (error: Error) => {
      cancellationFinished = true;
      cancelPid.reject(error);
    },
  );
  let blocked = false;
  try {
    const pid = await cancelPid.promise;
    const deadline = Date.now() + 5_000;
    while (!blocked && !cancellationFinished && Date.now() < deadline) {
      const [lock] = await db.$queryRaw<Array<{ waiting: boolean }>>`
        SELECT EXISTS(SELECT 1 FROM pg_locks WHERE pid = ${pid} AND locktype = 'advisory' AND NOT granted) AS waiting
      `;
      blocked = lock?.waiting ?? false;
    }
  } finally {
    release.resolve();
  }
  await creation;
  await assert.rejects(cancellation, /Enrollment_active_student_track_key/u);
  assert.equal(blocked, true, "Cancellation must wait for the uncommitted entry");
  const retained = await db.enrollmentAction.findUniqueOrThrow({ where: { id: pause.id } });
  assert.equal(retained.status, "SCHEDULED");
  assert.equal(
    await db.enrollment.count({ where: { studentId: student.id, classId: targetClass.id } }),
    1,
  );
});
