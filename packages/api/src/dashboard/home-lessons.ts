import type { Prisma } from "@lazuli/db";
import { sessionEndInstant } from "@lazuli/domain";
import {
  recordSessionInclude,
  responsibleTeacher,
  timeOnly,
  type RecordSession,
} from "../class-records/data.js";
import { dateOnly, endedWhere } from "./home-model.js";
import { pendingClassRecordCutoff } from "../class-records/pending-policy.js";

type Database = {
  classSession: {
    findMany: (args: {
      where: Prisma.ClassSessionWhereInput;
      orderBy: Prisma.ClassSessionOrderByWithRelationInput[];
      include: typeof recordSessionInclude;
    }) => Promise<RecordSession[]>;
  };
};

const DAY_MS = 86_400_000;
const HIGH_PRIORITY_DAYS = 7;

type PendingLesson = {
  id: string;
  classId: string;
  className: string;
  date: string;
  startTime: string;
  endTime: string;
  ageDays: number;
  priority: "high" | "low";
  missing: string[];
};
type TeacherLessons = {
  teacherId: string | null;
  teacherName: string;
  high: number;
  low: number;
  lessons: PendingLesson[];
};

/** A class record atomically confirms attendance, required content and completion. */
export async function readPendingLessons(database: Database, now: Date): Promise<TeacherLessons[]> {
  const rows = await database.classSession.findMany({
    where: {
      deletedAt: null,
      status: { not: "CANCELLED" },
      classRecord: null,
      class: { deletedAt: null },
      ...endedWhere(pendingClassRecordCutoff(now)),
    },
    orderBy: [{ date: "asc" }, { endTime: "asc" }, { id: "asc" }],
    include: recordSessionInclude,
  });
  const teachers = new Map<string | null, TeacherLessons>();
  for (const row of rows) {
    const ageDays = Math.floor((now.getTime() - sessionEndInstant(row).getTime()) / DAY_MS);
    const teacher = responsibleTeacher(row);
    const teacherId = teacher?.id ?? null;
    const group: TeacherLessons = teachers.get(teacherId) ?? {
      teacherId,
      teacherName: teacher?.name ?? "Professor não atribuído",
      high: 0,
      low: 0,
      lessons: [],
    };
    const priority = ageDays >= HIGH_PRIORITY_DAYS ? "high" : "low";
    if (priority === "high") group.high += 1;
    else group.low += 1;
    group.lessons.push({
      id: row.id,
      classId: row.classId,
      className: pendingClassName(row),
      date: dateOnly(row.date),
      startTime: timeOnly(row.startTime),
      endTime: timeOnly(row.endTime),
      ageDays,
      priority,
      missing: pendingMissing(row),
    });
    teachers.set(teacherId, group);
  }
  return [...teachers.values()].toSorted(compareTeachers);
}

function pendingClassName(row: RecordSession): string {
  if (row.class.scheduleType === "PERSONALIZED") return "PPT";
  return row.class.sharedStage?.name ?? "Sem estágio";
}

function pendingMissing(row: RecordSession): string[] {
  return row.attendanceConfirmedAt ? ["progresso"] : ["chamada", "progresso"];
}

function compareTeachers(left: TeacherLessons, right: TeacherLessons): number {
  return (
    Number(right.high > 0) - Number(left.high > 0) ||
    `${left.lessons[0]?.date}T${left.lessons[0]?.endTime}`.localeCompare(
      `${right.lessons[0]?.date}T${right.lessons[0]?.endTime}`,
    ) ||
    left.teacherName.localeCompare(right.teacherName, "pt-BR")
  );
}
