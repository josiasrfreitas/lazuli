import { responsibleTeacherId, sessionEndInstant } from "@lazuli/domain";
import type { RecordContext } from "../class-records/data.js";
import { dateOnly, timeOnly } from "../class-records/data.js";
import { notFound } from "../trpc/errors.js";
import { meetingsBetween, meetingKey } from "../teachers/schedule.js";
import type { Prisma } from "@lazuli/db";

type VisitRow = Prisma.EntryVisitGetPayload<{
  include: {
    candidate: { select: { id: true; fullName: true; status: true; studentId: true } };
    assessment: {
      select: {
        fileName: true;
        stageId: true;
        notes: true;
        correctedAt: true;
        uploadedAt: true;
        stage: { select: { name: true } };
        correctedFile: {
          select: { fileName: true; uploadedAt: true; uploadedBy: { select: { name: true } } };
        };
      };
    };
  };
}>;
type AssignedVisit = {
  id: string;
  candidate: { id: string; fullName: string };
  kind: VisitRow["kind"];
  status: VisitRow["status"];
  date: string;
  startTime: string;
  endTime: string;
  format: VisitRow["format"];
  notes: VisitRow["notes"];
  assessment: VisitRow["assessment"];
  canRecord: boolean;
};

export async function assignedVisit(context: RecordContext, id: string): Promise<AssignedVisit> {
  const visit = await context.database.entryVisit.findFirst({
    where: { id, deletedAt: null, candidate: { deletedAt: null } },
    include: {
      candidate: { select: { id: true, fullName: true, status: true, studentId: true } },
      assessment: {
        select: {
          fileName: true,
          stageId: true,
          notes: true,
          correctedAt: true,
          uploadedAt: true,
          stage: { select: { name: true } },
          correctedFile: {
            select: { fileName: true, uploadedAt: true, uploadedBy: { select: { name: true } } },
          },
        },
      },
    },
  });
  if (!visit) throw notFound("Encontro não encontrado.");
  const teacherId = await visitTeacherId(context, visit);
  if (context.staffUser.role === "TEACHER" && teacherId !== context.staffUser.id)
    throw notFound("Encontro não encontrado entre suas atribuições.");
  return {
    id: visit.id,
    candidate: { id: visit.candidate.id, fullName: visit.candidate.fullName },
    kind: visit.kind,
    status: visit.status,
    date: dateOnly(visit.date),
    startTime: timeOnly(visit.startTime),
    endTime: timeOnly(visit.endTime),
    format: visit.format,
    notes: visit.notes,
    assessment: visit.assessment,
    canRecord: canRecordVisit(visit, context.now),
  };
}

function canRecordVisit(visit: VisitRow, now: Date): boolean {
  return Boolean(
    visit.status !== "CANCELLED" &&
    (visit.candidate.status === "WAITING" ||
      (visit.kind === "PLACEMENT" &&
        visit.candidate.status === "ENROLLED" &&
        visit.candidate.studentId &&
        !visit.assessment?.stageId)) &&
    sessionEndInstant({ date: visit.date, endTime: visit.startTime }) <= now,
  );
}

async function visitTeacherId(context: RecordContext, visit: VisitRow): Promise<string | null> {
  let teacherId = visit.teacherId;
  if (visit.kind === "TRIAL" && visit.status === "SCHEDULED") {
    const meetings = await meetingsBetween({
      database: context.database,
      from: dateOnly(visit.date),
      through: dateOnly(visit.date),
      now: context.now,
    });
    const target = meetings.find(
      (row) =>
        meetingKey(row) ===
        meetingKey({
          classId: visit.classId!,
          slotId: visit.scheduleSlotId,
          sessionId: visit.classSessionId,
          date: dateOnly(visit.date),
        }),
    );
    teacherId = target && !target.cancelled ? responsibleTeacherId(target) : null;
  }
  return teacherId;
}

export async function assignedVisits(context: RecordContext): Promise<AssignedVisit[]> {
  const rows = await context.database.entryVisit.findMany({
    where: {
      teacherId: context.staffUser.id,
      kind: { in: ["PLACEMENT", "INTRODUCTION"] },
      deletedAt: null,
      candidate: { deletedAt: null },
    },
    select: { id: true },
    orderBy: [{ date: "desc" }, { startTime: "desc" }],
    take: 200,
  });
  return Promise.all(rows.map((row) => assignedVisit(context, row.id)));
}
