import { randomUUID } from "node:crypto";
import { db } from "@lazuli/db";
import type { Harness } from "./attendance-test-support.js";
import type { AppointmentScheduleInput } from "@lazuli/validators";

export async function appointmentFixture(harness: Harness) {
  const scenario = await harness.seedBaseScenario();
  const student = await harness.enrollStudent({
    classId: scenario.classId,
    stageId: scenario.stageId,
    suffix: "Bento",
  });
  const sourceEnd = new Date(`${harness.ns.sessionDate.toISOString().slice(0, 10)}T19:10:00Z`);
  await harness
    .caller(harness.ns.admin, sourceEnd)
    .attendance.confirmSession({
      sessionId: scenario.sessionId,
      rows: [{ enrollmentId: student.enrollmentId, status: "ABSENT" }],
    });
  const absence = await db.attendance.findFirstOrThrow({
    where: { classSessionId: scenario.sessionId, enrollmentId: student.enrollmentId },
  });
  const targetClassId = await harness.createClass({
    code: "target",
    teacherId: harness.ns.otherTeacher.id,
    stageId: scenario.stageId,
    semesterId: scenario.semesterId,
  });
  const targetId = await harness.createSession({
    classId: targetClassId,
    date: harness.ns.afterSessionDate,
  });
  const date = harness.ns.afterSessionDate.toISOString().slice(0, 10);
  const input: AppointmentScheduleInput = {
    id: randomUUID(),
    studentId: student.studentId,
    enrollmentId: student.enrollmentId,
    purpose: "MAKEUP",
    meeting: { kind: "CLASS", sessionId: targetId },
    plannedContent: "Prática de escuta.",
    notes: "",
    coverages: [{ attendanceId: absence.id, minutes: 120 }],
  };
  return {
    ...scenario,
    ...student,
    absence,
    targetId,
    targetClassId,
    input,
    before: new Date(`${date}T16:00:00Z`),
    after: new Date(`${date}T19:10:00Z`),
  };
}
