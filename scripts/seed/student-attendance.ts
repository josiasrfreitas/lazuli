import { tokenHash } from "../../packages/api/src/student-attendance/data.js";
import type { DatabaseClient, TransactionClient } from "../../packages/db/src/client.js";
import type { StaffUser } from "../../packages/api/src/trpc/context.js";
import {
  recordSessionInclude,
  responsibleTeacher,
  type RecordSession,
} from "../../packages/api/src/class-records/data.js";
import { recordActivity } from "../../packages/api/src/activity/record.js";
import { DEV_ADMIN, DEV_TEACHERS } from "../../packages/db/src/seed-dev-data.js";
import { isoOf, stableUuid, utcDate } from "../../packages/db/src/seed-dev-support.js";
import { saoPauloDateOnly, sessionEndInstant } from "../../packages/domain/src/session-time.js";
import {
  ATTENDANCE_SCENARIOS,
  declarationLocation,
  encounterWindow,
  historicalTokenHash,
  minutesAfter,
  referenceLocation,
  type AttendanceScenario,
} from "./student-attendance-data.js";

const ROTATION_AFTER_MINUTES = 2;
const DECLARATION_INTERVAL_MINUTES = 1 / 3;
const IN_PERSON_WINDOW_MINUTES = 5;
const SELECTED_NAME_INTERVAL = 3;
const FAMILY_NAME_WORD_COUNT = 2;
const MAX_EARLY_OPEN_MINUTES = 30;
const WINDOW_VALIDATION_MESSAGE =
  "Student-attendance window must fit its encounter and precede the final call.";
const STAFF_SELECT = { id: true, name: true, email: true, role: true, isEnabled: true } as const;
const FAMILY_STUDENT_IDS = ["school-student-161", "school-student-162"].map((key) =>
  stableUuid(["student", key]),
);

type Session = RecordSession;
type Member = {
  enrollmentId: string;
  studentId: string;
  name: string;
  status: "PRESENT" | "ABSENT";
};
type WindowTimes = { openedAt: Date; expiresAt: Date; closedAt: Date };
type SeedContext = {
  database: TransactionClient;
  session: Session;
  scenario: AttendanceScenario;
  teacher: StaffUser;
  confirmer: StaffUser;
};

/** Adds student evidence to existing final calls, without rewriting attendance or academic facts. */
export async function seedStudentAttendance(
  database: DatabaseClient,
  todayIso: string,
): Promise<void> {
  const staff = await database.user.findMany({
    where: { email: { in: [DEV_ADMIN.email, ...DEV_TEACHERS.map((row) => row.email)] } },
    select: STAFF_SELECT,
  });
  let encounters = 0;
  let declarations = 0;
  for (const scenario of ATTENDANCE_SCENARIOS) {
    const count = await database.$transaction(
      (transaction) => seedScenario(transaction, { scenario, staff, todayIso }),
      { timeout: 30_000 },
    );
    if (count > 0) encounters++;
    declarations += count;
  }
  process.stdout.write(
    `Student attendance loaded: ${encounters} encounters, ${declarations} declarations.\n`,
  );
}

async function seedScenario(
  database: TransactionClient,
  input: { scenario: AttendanceScenario; staff: StaffUser[]; todayIso: string },
): Promise<number> {
  const { scenario, staff, todayIso } = input;

  const sessions = await database.classSession.findMany({
    where: {
      classId: stableUuid(["class", scenario.classKey]),
      deletedAt: null,
      status: "SCHEDULED",
      date: { lt: utcDate(todayIso) },
      attendanceConfirmedAt: { not: null },
      classRecord: { is: { deletedAt: null } },
    },
    include: recordSessionInclude,
    orderBy: [{ date: "desc" }, { startTime: "desc" }],
  });
  if (scenario.kind === "SUBSTITUTE")
    sessions.sort((left, right) => Number(isSubstitute(right)) - Number(isSubstitute(left)));
  for (const session of sessions) {
    const members = await declarationMembers(database, { session, scenario });
    if (!members) continue;
    const teacher = staff.find((row) => row.id === responsibleTeacher(session)?.id);
    const confirmer = staff.find((row) => row.id === session.attendanceConfirmedById);
    if (!teacher || !confirmer)
      throw new Error("Student-attendance fixtures require the dated teacher and call author.");
    await seedEncounter({ database, session, scenario, teacher, confirmer }, members);
    return members.length;
  }
  return 0;
}

function isSubstitute(session: Session): boolean {
  return Boolean(
    session.classRecord?.teachingTeacherId &&
    session.classRecord.teachingTeacherId !== session.usualTeacherId,
  );
}

async function declarationMembers(
  database: TransactionClient,
  input: { session: Session; scenario: AttendanceScenario },
): Promise<Member[] | null> {
  const { session, scenario } = input;
  const rows = await database.attendance.findMany({
    where: {
      classSessionId: session.id,
      deletedAt: null,
      enrollment: {
        deletedAt: null,
        classId: session.classId,
        entryDate: { lte: session.date },
        OR: [{ exitDate: null }, { exitDate: { gt: session.date } }],
        student: { deletedAt: null },
      },
    },
    select: {
      enrollmentId: true,
      status: true,
      enrollment: { select: { studentId: true, student: { select: { fullName: true } } } },
    },
    orderBy: { enrollment: { student: { fullName: "asc" } } },
  });
  const roster: Member[] = rows.map((row) => ({
    enrollmentId: row.enrollmentId,
    studentId: row.enrollment.studentId,
    name: row.enrollment.student.fullName,
    status: row.status,
  }));
  const present = roster.filter((row) => row.status === "PRESENT");
  // Every encounter also has at least one teacher-confirmed present without a declaration.
  if (present.length <= scenario.declarations) return null;
  let selected = present.slice(0, scenario.declarations);
  if (scenario.kind === "FAMILY_NAME") {
    const family = present.filter((row) => FAMILY_STUDENT_IDS.includes(row.studentId));
    if (family.length !== FAMILY_STUDENT_IDS.length) return null;
    selected = [
      ...family,
      ...present.filter((row) => !FAMILY_STUDENT_IDS.includes(row.studentId)),
    ].slice(0, scenario.declarations);
  }
  if (scenario.kind === "EXPIRED") {
    const absent = roster.find((row) => row.status === "ABSENT");
    // An accepted declaration is evidence to review, never an automatic change to the final call.
    if (absent) selected[selected.length - 1] = absent;
  }
  return selected;
}

async function seedEncounter(context: SeedContext, members: Member[]): Promise<void> {
  const { session, scenario } = context;
  if (!session.attendanceConfirmedAt)
    throw new Error("Historical student declarations require an existing final call.");
  if ((session.class.format === "ONLINE") !== (scenario.kind === "ONLINE"))
    throw new Error("Student-attendance fixture format must match the actual class.");
  const times = encounterWindow(
    { ...session, attendanceConfirmedAt: session.attendanceConfirmedAt },
    scenario,
  );
  const windows = await encounterWindows(context, times);
  for (const [index, member] of members.entries()) {
    await persistDeclaration(context, { windows, member, index });
  }
}

async function encounterWindows(
  context: SeedContext,
  times: WindowTimes,
): Promise<Array<WindowTimes & { id: string }>> {
  const { session, scenario } = context;
  const windows: Array<WindowTimes & { id: string }> = [];
  if (scenario.kind === "ROTATED") {
    const rotatedAt = minutesAfter(times.openedAt, ROTATION_AFTER_MINUTES);
    windows.push(
      await persistWindow(context, { times: { ...times, closedAt: rotatedAt }, version: 1 }),
    );
    const end = sessionEndInstant(session);
    windows.push(
      await persistWindow(context, {
        times: {
          openedAt: rotatedAt,
          expiresAt: new Date(
            Math.min(
              minutesAfter(
                rotatedAt,
                session.class.format === "IN_PERSON" ? IN_PERSON_WINDOW_MINUTES : scenario.ttl,
              ).getTime(),
              end.getTime(),
            ),
          ),
          closedAt: times.closedAt,
        },
        version: 2,
      }),
    );
  } else windows.push(await persistWindow(context, { times, version: 1 }));
  return windows;
}

async function persistDeclaration(
  context: SeedContext,
  input: { windows: Array<WindowTimes & { id: string }>; member: Member; index: number },
): Promise<void> {
  const { session, scenario } = context;
  const { windows, member, index } = input;

  const rotated = scenario.kind === "ROTATED" && index >= 2;
  const window = windows[rotated ? 1 : 0]!;
  const submittedAt = minutesAfter(
    window.openedAt,
    DECLARATION_INTERVAL_MINUTES * (1 + (rotated ? index - 2 : index)),
  );
  if (submittedAt >= window.expiresAt || submittedAt >= window.closedAt)
    throw new Error("Student declaration must precede expiry and closing.");
  const family = scenario.kind === "FAMILY_NAME" && FAMILY_STUDENT_IDS.includes(member.studentId);
  const selected = family || index % SELECTED_NAME_INTERVAL === 0;
  const declaredName = declarationName(member, { family, selected });
  await context.database.attendanceDeclaration.create({
    data: {
      id: stableUuid(["attendance-declaration", session.id, member.enrollmentId]),
      classSessionId: session.id,
      windowId: window.id,
      enrollmentId: member.enrollmentId,
      declaredName,
      browserHash: tokenHash(
        `${session.id}:${stableUuid(["seed-attendance-browser", session.id, member.enrollmentId])}`,
      ),
      matchKind: selected ? "SELECTED" : "EXACT",
      submittedAt,
      ...declarationLocation({
        online: session.class.format === "ONLINE",
        submittedAt,
        variation: index,
      }),
      createdAt: submittedAt,
      updatedAt: submittedAt,
    },
  });
}

async function persistWindow(
  context: SeedContext,
  input: { times: WindowTimes; version: number },
): Promise<WindowTimes & { id: string }> {
  const { times, version } = input;
  const { database, session, scenario, teacher, confirmer } = context;
  assertWindowEncounterBounds(session, times);
  assertWindowBeforeFinalCall(session, times);
  const manualClose =
    scenario.kind === "MANUAL_CLOSE" || (scenario.kind === "ROTATED" && version === 1);
  const closer = manualClose ? teacher : confirmer;
  const id = stableUuid(["attendance-window", session.id, String(version)]);
  await database.attendanceWindow.create({
    data: {
      id,
      classSessionId: session.id,
      tokenHash: historicalTokenHash(),
      format: session.class.format,
      openedAt: times.openedAt,
      expiresAt: times.expiresAt,
      openedById: teacher.id,
      closedAt: times.closedAt,
      closedById: closer.id,
      ...referenceLocation(session.class.format === "ONLINE"),
      createdAt: times.openedAt,
      updatedAt: times.closedAt,
    },
  });
  await recordWindowActivity(context, { times, version, id, closer, manualClose });
  return { ...times, id };
}

function declarationName(member: Member, input: { family: boolean; selected: boolean }): string {
  if (input.family) return member.name.split(" ").slice(-FAMILY_NAME_WORD_COUNT).join(" ");
  if (input.selected) return member.name.split(" ").slice(0, -1).join(" ");
  return member.name;
}

function assertWindowEncounterBounds(session: Session, times: WindowTimes): void {
  const start = sessionEndInstant({ date: session.date, endTime: session.startTime });
  const end = sessionEndInstant(session);
  if (
    times.openedAt < minutesAfter(start, -MAX_EARLY_OPEN_MINUTES) ||
    times.openedAt >= end ||
    saoPauloDateOnly(times.openedAt) !== isoOf(session.date) ||
    times.expiresAt > end ||
    times.expiresAt <= times.openedAt ||
    times.closedAt < times.openedAt
  )
    throw new Error(WINDOW_VALIDATION_MESSAGE);
}

function assertWindowBeforeFinalCall(session: Session, times: WindowTimes): void {
  if (
    !session.attendanceConfirmedAt ||
    times.closedAt > session.attendanceConfirmedAt ||
    (session.classRecord && times.closedAt > session.classRecord.createdAt)
  )
    throw new Error(WINDOW_VALIDATION_MESSAGE);
}

async function recordWindowActivity(
  context: SeedContext,
  input: {
    times: WindowTimes;
    version: number;
    id: string;
    closer: StaffUser;
    manualClose: boolean;
  },
): Promise<void> {
  const { database, session, teacher } = context;
  const { times, version, id, closer, manualClose } = input;
  const subject = {
    type: "class" as const,
    id: session.classId,
    name: session.class.portalClassName,
  };
  const date = isoOf(session.date).split("-").toReversed().join("/");
  await recordActivity(database, {
    context: { staffUser: teacher, now: times.openedAt },
    action: "studentAttendance.open",
    details: {
      subject,
      description: `${date} · ${version > 1 ? "Novo link substitui o anterior; envios já recebidos são preservados." : "Recebimento de presença pelo aluno aberto para este encontro."}`,
      deduplicationKey: `seed-student-attendance/open/${id}`,
    },
  });
  await recordActivity(database, {
    context: { staffUser: closer, now: times.closedAt },
    action: "studentAttendance.close",
    details: {
      subject,
      description: `${date} · ${manualClose ? "Recebimento encerrado pelo professor" : "Recebimento encerrado na confirmação da chamada"}; envios recebidos preservados.`,
      deduplicationKey: `seed-student-attendance/close/${id}`,
    },
  });
}
