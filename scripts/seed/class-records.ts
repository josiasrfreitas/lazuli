import type { DatabaseClient, TransactionClient } from "../../packages/db/src/client.js";
import type { StaffUser } from "../../packages/api/src/trpc/context.js";
import type { ClassRecordSnapshot } from "../../packages/validators/src/class-records.js";
import { DEV_ADMIN, DEV_CLASSES, DEV_TEACHERS } from "../../packages/db/src/seed-dev-data.js";
import { addDays, isoOf, stableUuid, utcDate } from "../../packages/db/src/seed-dev-support.js";
import { saoPauloDateOnly, sessionEndInstant } from "../../packages/domain/src/session-time.js";
import { initialSnapshot } from "../../packages/api/src/class-records/planned.js";
import {
  recordSessionInclude,
  responsibleTeacher,
  type RecordSession,
} from "../../packages/api/src/class-records/data.js";
import { recordActivity } from "../../packages/api/src/activity/record.js";
import { copyClassSnapshot, correctedContent, performedContent } from "./class-records-data.js";
import {
  cancelSeedSession,
  safeAttendanceScenario,
  seedSessionSubstitute,
} from "./class-records-scenarios.js";

const RECENT_SESSIONS = 4;
const MINUTE_MS = 60_000;
const CALL_AFTER_END_MINUTES = 5;
const CLOSE_AFTER_END_MINUTES = 10;
const CORRECT_AFTER_END_MINUTES = 30;
const STAFF_SELECT = { id: true, name: true, email: true, role: true, isEnabled: true } as const;

type ScenarioState = {
  cancelled: boolean;
  noPresent: boolean;
  regularSubstitute: boolean;
  pptSubstitute: boolean;
  regularCorrection: boolean;
  pptContentCorrection: boolean;
  pptPresenceCorrection: boolean;
  regularDeviations: number;
  pptDeviations: number;
};
type SeedInput = {
  database: TransactionClient;
  admin: StaffUser;
  teachers: StaffUser[];
  todayIso: string;
  state: ScenarioState;
  classKey: string;
  variation: number;
};
type RecordVersion = { snapshot: ClassRecordSnapshot; reason: string; author: StaffUser; at: Date };

/** Completion is bounded to recent sessions; old attendance-only history remains explicit. */
export async function seedClassRecords(database: DatabaseClient, todayIso: string): Promise<void> {
  const admin = await database.user.findUniqueOrThrow({
    where: { email: DEV_ADMIN.email },
    select: STAFF_SELECT,
  });
  const teachers = await database.user.findMany({
    where: { email: { in: DEV_TEACHERS.map((row) => row.email) }, role: "TEACHER" },
    select: STAFF_SELECT,
    orderBy: { name: "asc" },
  });
  const state: ScenarioState = {
    cancelled: false,
    noPresent: false,
    regularSubstitute: false,
    pptSubstitute: false,
    regularCorrection: false,
    pptContentCorrection: false,
    pptPresenceCorrection: false,
    regularDeviations: 0,
    pptDeviations: 0,
  };
  for (const [classIndex, seed] of DEV_CLASSES.entries()) {
    const sessions = await database.classSession.findMany({
      where: {
        classId: stableUuid(["class", seed.key]),
        status: "SCHEDULED",
        date: { lt: utcDate(todayIso) },
      },
      select: { id: true },
      orderBy: [{ date: "desc" }, { startTime: "desc" }],
      take: RECENT_SESSIONS,
    });
    for (const [rank, session] of sessions.toReversed().entries()) {
      await database.$transaction(
        (transaction) =>
          seedRecordedSession(
            {
              database: transaction,
              admin,
              teachers,
              todayIso,
              state,
              classKey: seed.key,
              variation: classIndex * RECENT_SESSIONS + rank,
            },
            session.id,
          ),
        { timeout: 30_000 },
      );
    }
  }
}

async function seedRecordedSession(input: SeedInput, sessionId: string): Promise<void> {
  let session = await input.database.classSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: recordSessionInclude,
  });
  const regular = session.class.scheduleType === "REGULAR";
  if (
    input.classKey === "C2B" &&
    !input.state.cancelled &&
    (await safeAttendanceScenario(input.database, session, true))
  ) {
    await cancelSeedSession(input.database, session, input.admin);
    input.state.cancelled = true;
    return;
  }
  const noPresent =
    input.classKey === "C1B" &&
    !input.state.noPresent &&
    (await safeAttendanceScenario(input.database, session, true));
  if (noPresent) input.state.noPresent = true;
  const needsSubstitute = regular ? !input.state.regularSubstitute : !input.state.pptSubstitute;
  if (
    !noPresent &&
    needsSubstitute &&
    (await safeAttendanceScenario(input.database, session, false))
  ) {
    const substitute = await seedSessionSubstitute(
      input.database,
      session,
      input.admin,
      input.teachers,
    );
    if (substitute) {
      if (regular) input.state.regularSubstitute = true;
      else input.state.pptSubstitute = true;
      session = await input.database.classSession.findUniqueOrThrow({
        where: { id: sessionId },
        include: recordSessionInclude,
      });
    }
  }
  const teachingTeacher = responsibleTeacher(session);
  const teacher = input.teachers.find((row) => row.id === teachingTeacher?.id);
  if (!teacher)
    throw new Error("Class-record fixtures require the teacher responsible for the dated session.");
  const endedAt = sessionEndInstant(session);
  const calledAt = afterMinutes(endedAt, CALL_AFTER_END_MINUTES);
  const closedAt = afterMinutes(endedAt, CLOSE_AFTER_END_MINUTES);
  if (saoPauloDateOnly(closedAt) >= input.todayIso)
    throw new Error("Class-record fixtures cannot close a future school day.");
  await prepareManualCall(input.database, session, { teacher, calledAt, noPresent });
  const snapshot = await initialSnapshot(
    { database: input.database, staffUser: input.admin, now: closedAt },
    session,
  );
  const present = snapshot.entries.filter((row) => row.status === "PRESENT");
  if (present.length === 0)
    snapshot.note =
      "Nenhum aluno compareceu ao encontro. Próximo passo: verificar com as famílias a continuidade da rotina.";
  if (regular && present.length > 0) {
    const deviation =
      input.state.regularDeviations < 2 &&
      Boolean(snapshot.sharedPlanned?.items.some((item) => item.kind === "CONTENT"));
    snapshot.sharedContent = performedContent({
      stage: session.class.sharedStage?.name ?? null,
      variation: input.variation,
      review: deviation,
    });
    if (deviation) input.state.regularDeviations++;
  }
  if (!regular) {
    for (const [index, entry] of snapshot.entries.entries()) {
      if (entry.status !== "PRESENT") continue;
      const deviation =
        input.state.pptDeviations < 2 &&
        Boolean(entry.planned?.items.some((item) => item.kind === "CONTENT"));
      entry.content = performedContent({
        stage: entry.stage,
        variation: input.variation + index,
        review: deviation,
      });
      if (deviation) input.state.pptDeviations++;
    }
  }
  const versions: RecordVersion[] = [
    {
      snapshot,
      reason: "Baixa da aula após conferência manual da presença e do conteúdo realizado.",
      author: teacher,
      at: closedAt,
    },
  ];
  const correction = await correctedRecord(input, session, snapshot, teacher);
  if (correction) versions.push(correction);
  await persistRecord(input.database, session, teacher, versions);
}

async function prepareManualCall(
  database: TransactionClient,
  session: RecordSession,
  input: {
    teacher: StaffUser;
    calledAt: Date;
    noPresent: boolean;
  },
): Promise<void> {
  await database.attendance.updateMany({
    where: { classSessionId: session.id, deletedAt: null },
    data: {
      ...(input.noPresent ? { status: "ABSENT" } : {}),
      recordedAt: input.calledAt,
      recordedById: input.teacher.id,
      createdAt: input.calledAt,
      updatedAt: input.calledAt,
    },
  });
  await database.classSession.update({
    where: { id: session.id },
    data: {
      attendanceConfirmedAt: input.calledAt,
      attendanceConfirmedById: input.teacher.id,
      attendanceLastCommittedAt: input.calledAt,
      responsibilityFrozenAt: input.calledAt,
    },
  });
}

async function correctedRecord(
  input: SeedInput,
  session: RecordSession,
  initial: ClassRecordSnapshot,
  teacher: StaffUser,
): Promise<RecordVersion | null> {
  const snapshot = copyClassSnapshot(initial);
  const end = sessionEndInstant(session);
  if (input.classKey === "MWBA" && !input.state.regularCorrection && snapshot.sharedContent) {
    snapshot.sharedContent = correctedContent(snapshot.sharedContent);
    input.state.regularCorrection = true;
    return {
      snapshot,
      author: teacher,
      at: afterMinutes(end, CORRECT_AFTER_END_MINUTES),
      reason: "Complementar o relato com a prática de escuta realizada na aula.",
    };
  }
  const present = snapshot.entries.find((row) => row.status === "PRESENT");
  if (input.classKey === "PPT-C2" && !input.state.pptContentCorrection && present?.content) {
    present.content = correctedContent(present.content);
    input.state.pptContentCorrection = true;
    return {
      snapshot,
      author: teacher,
      at: afterMinutes(end, CORRECT_AFTER_END_MINUTES),
      reason: "Detalhar a devolutiva e a prática individual que ficaram resumidas na baixa.",
    };
  }
  const correctionDay = addDays(session.date, 1);
  if (
    input.classKey !== "PPT-T1" ||
    input.state.pptPresenceCorrection ||
    !present ||
    isoOf(correctionDay) >= input.todayIso ||
    !(await safeAttendanceScenario(input.database, session, false))
  )
    return null;
  const at = sessionEndInstant({ date: correctionDay, endTime: "15:00" });
  present.status = "ABSENT";
  present.content = null;
  input.state.pptPresenceCorrection = true;
  await input.database.attendance.updateMany({
    where: { classSessionId: session.id, enrollmentId: present.enrollmentId, deletedAt: null },
    data: { status: "ABSENT", lastModifiedAt: at, lastModifiedById: input.admin.id, updatedAt: at },
  });
  return {
    snapshot,
    author: input.admin,
    at,
    reason:
      "Após conferência com o professor, corrigir uma presença marcada indevidamente; preservar o relato anterior no histórico.",
  };
}

async function persistRecord(
  database: TransactionClient,
  session: RecordSession,
  teacher: StaffUser,
  versions: RecordVersion[],
): Promise<void> {
  const id = stableUuid(["class-session-record", session.id]);
  const latest = versions.at(-1)!;
  await database.classSessionRecord.create({
    data: {
      id,
      classSessionId: session.id,
      teachingTeacherId: teacher.id,
      snapshot: latest.snapshot,
      version: versions.length,
      createdAt: versions[0]!.at,
      updatedAt: latest.at,
    },
  });
  for (const [index, version] of versions.entries()) {
    await database.classSessionRecordRevision.create({
      data: {
        id: stableUuid(["class-session-record-revision", id, String(index + 1)]),
        recordId: id,
        version: index + 1,
        snapshot: version.snapshot,
        reason: version.reason,
        recordedById: version.author.id,
        createdAt: version.at,
        updatedAt: version.at,
      },
    });
    await recordActivity(
      database,
      { staffUser: version.author, now: version.at },
      index === 0 ? "classRecords.confirm" : "classRecords.correct",
      {
        subject: { type: "class", id: session.classId, name: session.class.portalClassName },
        description: `${isoOf(session.date).split("-").toReversed().join("/")} · ${version.reason}`,
        deduplicationKey: `seed-class-record/${id}/${index + 1}`,
      },
    );
  }
  await database.classSession.update({
    where: { id: session.id },
    data: { attendanceLastCommittedAt: latest.at },
  });
}

function afterMinutes(instant: Date, minutes: number): Date {
  return new Date(instant.getTime() + minutes * MINUTE_MS);
}
