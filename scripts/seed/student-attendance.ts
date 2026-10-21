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
      async (transaction) => {
        const sessions = await transaction.classSession.findMany({
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
          const members = await declarationMembers(transaction, session, scenario);
          if (!members) continue;
          const teacher = staff.find((row) => row.id === responsibleTeacher(session)?.id);
          const confirmer = staff.find((row) => row.id === session.attendanceConfirmedById);
          if (!teacher || !confirmer)
            throw new Error(
              "Student-attendance fixtures require the dated teacher and call author.",
            );
          await seedEncounter(
            { database: transaction, session, scenario, teacher, confirmer },
            members,
          );
          return members.length;
        }
        return 0;
      },
      { timeout: 30_000 },
    );
    if (count > 0) encounters++;
    declarations += count;
  }
  process.stdout.write(
    `Student attendance loaded: ${encounters} encounters, ${declarations} declarations.\n`,
  );
}

function isSubstitute(session: Session): boolean {
  return Boolean(
    session.classRecord?.teachingTeacherId &&
    session.classRecord.teachingTeacherId !== session.usualTeacherId,
  );
}

async function declarationMembers(
  database: TransactionClient,
  session: Session,
  scenario: AttendanceScenario,
): Promise<Member[] | null> {
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
  const windows: Array<WindowTimes & { id: string }> = [];
  if (scenario.kind === "ROTATED") {
    const rotatedAt = minutesAfter(times.openedAt, 8);
    windows.push(await persistWindow(context, { ...times, closedAt: rotatedAt }, 1));
    const end = sessionEndInstant(session);
    windows.push(
      await persistWindow(
        context,
        {
          openedAt: rotatedAt,
          expiresAt: new Date(
            Math.min(minutesAfter(rotatedAt, scenario.ttl).getTime(), end.getTime()),
          ),
          closedAt: times.closedAt,
        },
        2,
      ),
    );
  } else windows.push(await persistWindow(context, times, 1));
  for (const [index, member] of members.entries()) {
    const rotated = scenario.kind === "ROTATED" && index >= 2;
    const window = windows[rotated ? 1 : 0]!;
    const submittedAt = minutesAfter(window.openedAt, 1 + (rotated ? index - 2 : index));
    if (submittedAt >= window.expiresAt || submittedAt >= window.closedAt)
      throw new Error("Student declaration must precede expiry and closing.");
    const family = scenario.kind === "FAMILY_NAME" && FAMILY_STUDENT_IDS.includes(member.studentId);
    const selected = family || index % 3 === 0;
    const declaredName = family
      ? member.name.split(" ").slice(-2).join(" ")
      : selected
        ? member.name.split(" ").slice(0, -1).join(" ")
        : member.name;
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
}

async function persistWindow(
  context: SeedContext,
  times: WindowTimes,
  version: number,
): Promise<WindowTimes & { id: string }> {
  const { database, session, scenario, teacher, confirmer } = context;
  const start = sessionEndInstant({ date: session.date, endTime: session.startTime });
  const end = sessionEndInstant(session);
  if (
    times.openedAt < minutesAfter(start, -30) ||
    times.openedAt >= end ||
    saoPauloDateOnly(times.openedAt) !== isoOf(session.date) ||
    times.expiresAt > end ||
    times.expiresAt <= times.openedAt ||
    times.closedAt < times.openedAt ||
    !session.attendanceConfirmedAt ||
    times.closedAt > session.attendanceConfirmedAt ||
    (session.classRecord && times.closedAt > session.classRecord.createdAt)
  )
    throw new Error("Student-attendance window must fit its encounter and precede the final call.");
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
      ...referenceLocation(session.class.format === "ONLINE", scenario.kind !== "EXPIRED"),
      createdAt: times.openedAt,
      updatedAt: times.closedAt,
    },
  });
  const subject = {
    type: "class" as const,
    id: session.classId,
    name: session.class.portalClassName,
  };
  const date = isoOf(session.date).split("-").toReversed().join("/");
  await recordActivity(
    database,
    { staffUser: teacher, now: times.openedAt },
    "studentAttendance.open",
    {
      subject,
      description: `${date} · ${version > 1 ? "Novo link substitui o anterior; envios já recebidos são preservados." : "Recebimento de presença pelo aluno aberto para este encontro."}`,
      deduplicationKey: `seed-student-attendance/open/${id}`,
    },
  );
  await recordActivity(
    database,
    { staffUser: closer, now: times.closedAt },
    "studentAttendance.close",
    {
      subject,
      description: `${date} · ${manualClose ? "Recebimento encerrado pelo professor" : "Recebimento encerrado na confirmação da chamada"}; envios recebidos preservados.`,
      deduplicationKey: `seed-student-attendance/close/${id}`,
    },
  );
  return { ...times, id };
}
