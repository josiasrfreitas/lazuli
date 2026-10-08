import type { Prisma } from "@lazuli/db";
import { responsibleTeacherId, saoPauloDateOnly } from "@lazuli/domain";
import type { teacherListInputSchema, z } from "@lazuli/validators";
import { notFound } from "../trpc/errors.js";
import { responsibilitySelect, usualTeacherOn } from "./responsibility.js";
import { meetingsBetween } from "./schedule.js";

type Database = Prisma.TransactionClient;
export const teacherSelect = {
  id: true,
  name: true,
  email: true,
  isEnabled: true,
  teacherProfile: { select: { cpf: true, departureDate: true } },
} satisfies Prisma.UserSelect;

export async function readTeacher(database: Database, id: string) {
  const teacher = await database.user.findFirst({
    where: { id, role: "TEACHER", deletedAt: null },
    select: teacherSelect,
  });
  if (!teacher) throw notFound("Professor não encontrado.");
  return teacher;
}

export async function listTeachers(
  database: Database,
  input: z.infer<typeof teacherListInputSchema>,
  now: Date,
) {
  const today = new Date(saoPauloDateOnly(now));
  const eligible: Prisma.UserWhereInput = {
    OR: [
      { teacherProfile: null },
      { teacherProfile: { departureDate: null } },
      { teacherProfile: { departureDate: { gt: today } } },
    ],
  };
  const where: Prisma.UserWhereInput = {
    role: "TEACHER",
    deletedAt: null,
    name: { contains: input.search, mode: "insensitive" },
    AND: [
      ...(input.active === "active" ? [eligible] : []),
      ...(input.active === "departed"
        ? [{ teacherProfile: { departureDate: { lte: today } } }]
        : []),
      ...(input.active === "scheduled"
        ? [{ teacherProfile: { departureDate: { gt: today } } }]
        : []),
      ...(input.access === "enabled" ? [{ isEnabled: true }, eligible] : []),
      ...(input.access === "disabled"
        ? [{ OR: [{ isEnabled: false }, { teacherProfile: { departureDate: { lte: today } } }] }]
        : []),
    ],
  };
  const total = await database.user.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / input.pageSize));
  const page = Math.min(input.page, pageCount);
  const rows = await database.user.findMany({
    where,
    select: teacherSelect,
    orderBy: [{ name: "asc" }, { id: "asc" }],
    skip: (page - 1) * input.pageSize,
    take: input.pageSize,
  });
  const classCounts = await currentClassCounts(database, rows.map((row) => row.id), today);
  return {
    rows: rows.map((row) => ({ ...row, classCount: classCounts.get(row.id) ?? 0 })),
    page,
    pageSize: input.pageSize,
    pageCount,
    total,
    today: saoPauloDateOnly(now),
  };
}

async function currentClassCounts(database: Database, teacherIds: string[], today: Date) {
  const counts = new Map<string, number>();
  if (teacherIds.length === 0) return counts;
  const classes = await database.class.findMany({
    where: {
      deletedAt: null,
      status: "ACTIVE",
      semester: { deletedAt: null, startDate: { lte: today }, endDate: { gte: today } },
      OR: [
        { teacherId: { in: teacherIds } },
        { teacherAssignments: { some: { teacherId: { in: teacherIds }, supersededAt: null } } },
      ],
    },
    select: responsibilitySelect,
  });
  for (const row of classes) {
    const teacher = usualTeacherOn(row, today);
    if (teacher && teacherIds.includes(teacher.id)) {
      counts.set(teacher.id, (counts.get(teacher.id) ?? 0) + 1);
    }
  }
  return counts;
}

export async function teacherOptions(database: Database, date: string, search: string) {
  return database.user.findMany({
    where: {
      role: "TEACHER",
      deletedAt: null,
      name: { contains: search, mode: "insensitive" },
      OR: [
        { teacherProfile: null },
        { teacherProfile: { departureDate: null } },
        { teacherProfile: { departureDate: { gt: new Date(date) } } },
      ],
    },
    select: { id: true, name: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: 30,
  });
}

export async function uncoveredMeetings(
  database: Database,
  input: { page: number; pageSize: number },
  now: Date,
) {
  const from = saoPauloDateOnly(now);
  const end = await database.semester.findFirst({
    where: { deletedAt: null, endDate: { gte: new Date(from) } },
    orderBy: { endDate: "desc" },
    select: { endDate: true },
  });
  const rows = end
    ? (
        await meetingsBetween({
          database,
          from,
          through: end.endDate.toISOString().slice(0, 10),
          now,
        })
      ).filter((row) => responsibleTeacherId(row) === null)
    : [];
  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / input.pageSize));
  const page = Math.min(input.page, pageCount);
  return {
    rows: rows
      .slice((page - 1) * input.pageSize, page * input.pageSize)
      .map((row) => ({ ...row, id: `${row.classId}:${row.slotId ?? row.sessionId}:${row.date}` })),
    total,
    page,
    pageSize: input.pageSize,
    pageCount,
  };
}

export async function teacherClasses(
  database: Database,
  input: { id: string; page: number; pageSize: number },
  now: Date,
) {
  await readTeacher(database, input.id);
  const today = new Date(saoPauloDateOnly(now));
  const where: Prisma.ClassWhereInput = {
    deletedAt: null,
    OR: [{ teacherId: input.id }, { teacherAssignments: { some: { teacherId: input.id } } }],
  };
  const total = await database.class.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / input.pageSize));
  const page = Math.min(input.page, pageCount);
  const rows = await database.class.findMany({
    where,
    skip: (page - 1) * input.pageSize,
    take: input.pageSize,
    orderBy: [{ year: "desc" }, { internalCode: "asc" }],
    select: {
      id: true,
      internalCode: true,
      status: true,
      portalClassName: true,
      format: true,
      scheduleType: true,
      sharedStage: { select: { name: true, track: { select: { name: true } } } },
      semester: { select: { name: true } },
      _count: {
        select: {
          enrollments: {
            where: {
              deletedAt: null,
              entryDate: { lte: today },
              OR: [{ exitDate: null }, { exitDate: { gt: today } }],
              actions: {
                none: {
                  status: "SCHEDULED",
                  kind: { in: ["PAUSE", "EXIT"] },
                  effectiveDate: { lte: today },
                },
              },
            },
          },
        },
      },
      scheduleSlots: {
        where: { deletedAt: null },
        select: { weekday: true, startTime: true, endTime: true },
      },
    },
  });
  return {
    rows: rows.map(({ _count, ...row }) => ({ ...row, studentCount: _count.enrollments })),
    page,
    pageSize: input.pageSize,
    total,
    pageCount,
  };
}

/** Count distinct current students of the teacher's usual classes, as of the school date. */
export async function teacherStudentCount(database: Database, teacherId: string, now: Date) {
  const today = new Date(saoPauloDateOnly(now));
  const classes = await database.class.findMany({
    where: {
      deletedAt: null,
      status: "ACTIVE",
      semester: { deletedAt: null, startDate: { lte: today }, endDate: { gte: today } },
      OR: [{ teacherId }, { teacherAssignments: { some: { teacherId, supersededAt: null } } }],
    },
    select: { id: true, ...responsibilitySelect },
  });
  const classIds = classes
    .filter((row) => usualTeacherOn(row, today)?.id === teacherId)
    .map((row) => row.id);
  if (classIds.length === 0) return 0;
  return database.student.count({
    where: {
      deletedAt: null,
      enrollments: {
        some: {
          classId: { in: classIds },
          deletedAt: null,
          entryDate: { lte: today },
          OR: [{ exitDate: null }, { exitDate: { gt: today } }],
          actions: {
            none: {
              status: "SCHEDULED",
              kind: { in: ["PAUSE", "EXIT"] },
              effectiveDate: { lte: today },
            },
          },
        },
      },
    },
  });
}
