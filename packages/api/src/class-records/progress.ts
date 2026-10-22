import { saoPauloDateOnly, sessionEndInstant } from "@lazuli/domain";
import type { ClassRecordSnapshot } from "@lazuli/validators";
import { notFound } from "../trpc/errors.js";
import {
  canRead,
  dateOnly,
  recordSessionInclude,
  storedSnapshot,
  timeOnly,
  type RecordContext,
  type RecordSession,
} from "./data.js";

type ProgressState = "CANCELLED" | "UPCOMING" | "RECORDED" | "PENDING";
type StageProgressResult = {
  rows: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    state: ProgressState;
    attendanceRecorded: boolean;
    content: ClassRecordSnapshot["sharedContent"];
  }[];
  today: string;
  latest: { date: string; page: number | null; reference: string | null } | null;
};

function progressState(session: RecordSession, now: Date): ProgressState {
  if (session.status === "CANCELLED") return "CANCELLED";
  if (sessionEndInstant(session) > now) return "UPCOMING";
  return session.classRecord ? "RECORDED" : "PENDING";
}

/** Recorded coverage only: planned content must never appear as completed pages. */
export async function classStageProgress(
  context: RecordContext,
  classId: string,
): Promise<StageProgressResult> {
  const exists = await context.database.class.findFirst({
    where: { id: classId, deletedAt: null },
    select: { id: true },
  });
  if (!exists) throw notFound("Turma não encontrada.");
  const today = saoPauloDateOnly(context.now);
  const sessions = await context.database.classSession.findMany({
    where: { classId, deletedAt: null, date: { lte: new Date(today) } },
    include: recordSessionInclude,
    orderBy: [{ date: "desc" }, { startTime: "desc" }, { id: "desc" }],
  });
  const rows = sessions
    .filter((session) => canRead(context, session))
    .map((session) => {
      const state = progressState(session, context.now);
      const content =
        state === "RECORDED" ? (storedSnapshot(session)?.sharedContent ?? null) : null;
      return {
        id: session.id,
        date: dateOnly(session.date),
        startTime: timeOnly(session.startTime),
        endTime: timeOnly(session.endTime),
        state,
        attendanceRecorded: Boolean(session.attendanceConfirmedAt || session.classRecord),
        content,
      };
    });
  const latest = rows.find((row) => (row.content?.pageFrom ?? null) !== null);
  return {
    rows,
    today,
    latest: latest?.content
      ? {
          date: latest.date,
          page: latest.content.pageTo ?? latest.content.pageFrom,
          reference: latest.content.reference,
        }
      : null,
  };
}
