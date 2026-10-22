import type { Prisma } from "@lazuli/db";
import { saoPauloDateOnly, teachingMinutes } from "@lazuli/domain";
import { dateToTimeString } from "../classes/time.js";
import { responsibilitySelect, usualTeacherOn } from "./responsibility.js";

const agendaSelect = {
  ...responsibilitySelect,
  id: true,
  internalCode: true,
  portalClassName: true,
  scheduleType: true,
  format: true,
  sharedStage: { select: { name: true } },
  scheduleSlots: {
    where: { deletedAt: null },
    orderBy: [{ startTime: "asc" }, { id: "asc" }],
    select: { id: true, weekday: true, startTime: true, endTime: true },
  },
} satisfies Prisma.ClassSelect;
type AgendaClass = Prisma.ClassGetPayload<{ select: typeof agendaSelect }>;
type AgendaRow = {
  id: string;
  weekday: AgendaClass["scheduleSlots"][number]["weekday"];
  startTime: string;
  endTime: string;
  classId: string;
  className: string;
  classCode: string;
  scheduleType: AgendaClass["scheduleType"];
  format: AgendaClass["format"];
  stageName: string | null;
  minutes: number;
};

/** Recurring timetable of the teacher's current classes, independent of dated exceptions. */
export async function teacherAgenda({
  database,
  teacherId,
  now,
}: {
  database: Prisma.TransactionClient;
  teacherId: string;
  now: Date;
}): Promise<{ rows: AgendaRow[]; minutes: number }> {
  const today = new Date(saoPauloDateOnly(now));
  const classes = await database.class.findMany({
    where: {
      deletedAt: null,
      status: "ACTIVE",
      semester: { deletedAt: null, startDate: { lte: today }, endDate: { gte: today } },
      OR: [{ teacherId }, { teacherAssignments: { some: { teacherId, supersededAt: null } } }],
    },
    orderBy: [{ internalCode: "asc" }, { id: "asc" }],
    select: agendaSelect,
  });
  const rows = classes
    .filter((row) => usualTeacherOn(row, today)?.id === teacherId)
    .flatMap((row) => agendaClassRows(row));
  return { rows, minutes: rows.reduce((total, row) => total + row.minutes, 0) };
}

function agendaClassRows(row: AgendaClass): AgendaRow[] {
  return row.scheduleSlots.map((slot) => {
    const startTime = dateToTimeString(slot.startTime);
    const endTime = dateToTimeString(slot.endTime);
    return {
      id: slot.id,
      weekday: slot.weekday,
      startTime,
      endTime,
      classId: row.id,
      className: row.portalClassName,
      classCode: row.internalCode,
      scheduleType: row.scheduleType,
      format: row.format,
      stageName: row.sharedStage?.name ?? null,
      minutes: teachingMinutes({ startTime, endTime }),
    };
  });
}
