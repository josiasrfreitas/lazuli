import type { Prisma } from "@lazuli/db";
import { sessionEndInstant } from "@lazuli/domain";
import { responsibleTeacher, timeOnly } from "../class-records/data.js";
import { loadTeacherIdentities, type TeacherIdentity } from "../teachers/identity-data.js";
import { responsibilitySelect } from "../teachers/responsibility.js";
import { dateOnly, endedWhere } from "./home-model.js";
import { pendingClassRecordCutoff } from "../class-records/pending-policy.js";

const pendingSessionSelect = {
  id: true,
  classId: true,
  date: true,
  startTime: true,
  endTime: true,
  scheduleSlotId: true,
  responsibilityFrozenAt: true,
  usualTeacherId: true,
  attendanceConfirmedAt: true,
  class: {
    select: {
      ...responsibilitySelect,
      teacher: false,
      teacherAssignments: {
        ...responsibilitySelect.teacherAssignments,
        select: { id: true, effectiveDate: true, teacherId: true },
      },
      scheduleType: true,
      sharedStage: { select: { name: true } },
      substitutions: {
        where: { revokedAt: null, deletedAt: null },
        orderBy: { recordedAt: "desc" },
        select: {
          teacherId: true,
          date: true,
          scheduleSlotId: true,
          classSessionId: true,
        },
      },
    },
  },
} satisfies Prisma.ClassSessionSelect;
type LoadedPendingSession = Prisma.ClassSessionGetPayload<{ select: typeof pendingSessionSelect }>;
type ResponsibleClass = Parameters<typeof responsibleTeacher>[0]["class"];
type PendingSession = Omit<LoadedPendingSession, "class"> & {
  class: ResponsibleClass & Pick<LoadedPendingSession["class"], "scheduleType" | "sharedStage">;
};
type Database = Parameters<typeof loadTeacherIdentities>[0] & {
  classSession: {
    findMany: (args: {
      where: Prisma.ClassSessionWhereInput;
      orderBy: Prisma.ClassSessionOrderByWithRelationInput[];
      select: typeof pendingSessionSelect;
    }) => Promise<LoadedPendingSession[]>;
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
type TeacherLessonSummary = Omit<TeacherLessons, "lessons"> & { total: number };

/** A class record atomically confirms attendance, required content and completion. */
export async function readPendingLessons(database: Database, now: Date): Promise<TeacherLessons[]> {
  const rows = await loadPendingLessonRows(database, now);
  const teachers = new Map<string | null, TeacherLessons>();
  for (const row of rows) {
    const ageDays = Math.floor((now.getTime() - sessionEndInstant(row).getTime()) / DAY_MS);
    const teacher = responsibleTeacher({ ...row, classRecord: null });
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

/** The closed disclosures need counts, not every lesson's detail payload. */
export async function readPendingLessonSummaries(
  database: Database,
  now: Date,
): Promise<TeacherLessonSummary[]> {
  const teachers = await readPendingLessons(database, now);
  return teachers.map(({ lessons, ...teacher }) => ({
    ...teacher,
    total: lessons.length,
  }));
}

export async function readPendingLessonPage(
  database: Database,
  input: { now: Date; teacherId: string | null; page: number; pageSize: number },
): Promise<{ total: number; lessons: PendingLesson[] }> {
  const teachers = await readPendingLessons(database, input.now);
  const teacher = teachers.find((group) => group.teacherId === input.teacherId);
  const lessons = teacher?.lessons ?? [];
  const start = (input.page - 1) * input.pageSize;
  return { total: lessons.length, lessons: lessons.slice(start, start + input.pageSize) };
}

function pendingClassName(row: PendingSession): string {
  if (row.class.scheduleType === "PERSONALIZED") return "PPT";
  return row.class.sharedStage?.name ?? "Sem estágio";
}

function pendingMissing(row: PendingSession): string[] {
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

async function loadPendingLessonRows(database: Database, now: Date): Promise<PendingSession[]> {
  const rows = await database.classSession.findMany({
    where: {
      deletedAt: null,
      status: { not: "CANCELLED" },
      classRecord: null,
      class: { deletedAt: null },
      ...endedWhere(pendingClassRecordCutoff(now)),
    },
    orderBy: [{ date: "asc" }, { endTime: "asc" }, { id: "asc" }],
    select: pendingSessionSelect,
  });
  const classes = new Map(rows.map((row) => [row.classId, row.class]));
  const teachers = await loadTeacherIdentities(
    database,
    [...classes.values()].flatMap((row) => [
      row.teacherId,
      ...row.teacherAssignments.map((item) => item.teacherId),
      ...row.substitutions.map((item) => item.teacherId),
    ]),
  );
  const hydrated = new Map(
    [...classes].map(([id, row]) => [id, hydratePendingClass(row, teachers)]),
  );
  return rows.map((row) => ({ ...row, class: hydrated.get(row.classId)! }));
}
function hydratePendingClass(
  row: LoadedPendingSession["class"],
  teachers: Map<string, TeacherIdentity>,
): PendingSession["class"] {
  return {
    ...row,
    teacher: teachers.get(row.teacherId)!,
    teacherAssignments: row.teacherAssignments.map((item) => ({
      ...item,
      teacher: teachers.get(item.teacherId)!,
    })),
    substitutions: row.substitutions.map((item) => ({
      ...item,
      teacher: teachers.get(item.teacherId)!,
    })),
  };
}
