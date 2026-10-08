import assert from "node:assert/strict";
import test from "node:test";
import {
  meetingKey,
  projectMeeting,
  type MeetingCandidate,
  type ProjectionContext,
} from "../../src/teachers/schedule-projection.js";
import type { ScheduleSession } from "../../src/teachers/schedule-data.js";

function candidate(): MeetingCandidate {
  return {
    classRow: {
      id: "class",
      status: "ACTIVE",
      internalCode: "R1",
      portalClassName: "Regular 1",
      scheduleType: "REGULAR",
      format: "ONLINE",
      sharedStage: { name: "Stage 2" },
      semester: { startDate: new Date("2026-07-01"), endDate: new Date("2026-12-01") },
      scheduleSlots: [],
      teacherId: "current",
      teacherAssignments: [],
      teacher: { id: "current", name: "Docente atual", teacherProfile: { departureDate: null } },
    },
    date: "2026-10-08",
    slotId: "slot",
    sessionId: null,
    start: new Date("2000-01-01T19:00:00Z"),
    end: new Date("2000-01-01T21:00:00Z"),
  };
}
function context(): ProjectionContext {
  return {
    closed: new Set(),
    sessions: new Map(),
    substitutions: new Map(),
    now: new Date("2026-10-08T12:00:00Z"),
  };
}
void test("projected lessons expose modality, stage, duration and the effective teacher", () => {
  const row = projectMeeting(candidate(), context());
  assert.ok(row);
  assert.equal(row.stageName, "Stage 2");
  assert.equal(row.format, "ONLINE");
  assert.equal(row.scheduleType, "REGULAR");
  assert.equal(row.usualTeacherId, "current");
  assert.equal(row.minutes, 120);
  assert.equal(row.editable, true);
});
void test("a frozen session preserves its teacher and recorded lesson on a closed day", () => {
  const input = candidate();
  const state = context();
  state.closed.add(input.date);
  const session: ScheduleSession = {
    id: "session",
    classId: "class",
    scheduleSlotId: "slot",
    date: new Date(input.date),
    startTime: input.start,
    endTime: input.end,
    status: "SCHEDULED",
    deletedAt: null,
    responsibilityFrozenAt: new Date("2026-10-08T10:00:00Z"),
    usualTeacherId: "historical",
    usualTeacher: { id: "historical", name: "Docente anterior" },
    attendanceConfirmedAt: null,
    attendanceLastCommittedAt: null,
    _count: { attendanceRows: 1 },
  };
  state.sessions.set(meetingKey({ classId: "class", slotId: "slot", date: input.date }), session);
  const row = projectMeeting(input, state);
  assert.ok(row);
  assert.equal(row.usualTeacherId, "historical");
  assert.equal(row.sessionId, "session");
  assert.equal(row.editable, false);
  state.sessions.set(meetingKey({ classId: "class", slotId: "slot", date: input.date }), {
    ...session,
    status: "CANCELLED",
  });
  assert.equal(projectMeeting(input, state), null);
});
void test("a closed day suppresses a projected lesson without attendance", () => {
  const state = context();
  state.closed.add("2026-10-08");
  assert.equal(projectMeeting(candidate(), state), null);
});
