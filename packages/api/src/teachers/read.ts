import type { Prisma } from "@lazuli/db";
import { responsibleTeacherId, saoPauloDateOnly } from "@lazuli/domain";
import type { teacherListInputSchema, z } from "@lazuli/validators";
import { notFound } from "../trpc/errors.js";
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
  return { rows, page, pageSize: input.pageSize, pageCount, total, today: saoPauloDateOnly(now) };
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
) {
  await readTeacher(database, input.id);
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
      semester: { select: { name: true } },
      scheduleSlots: {
        where: { deletedAt: null },
        select: { weekday: true, startTime: true, endTime: true },
      },
    },
  });
  return { rows, page, pageSize: input.pageSize, total, pageCount };
}
