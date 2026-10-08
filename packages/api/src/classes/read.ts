import type { Prisma } from "@lazuli/db";
import { saoPauloDateOnly } from "@lazuli/domain";
import type { classListInputSchema, z } from "@lazuli/validators";

import { CLASS_NOT_FOUND_MESSAGE } from "./errors.js";
import { notFound } from "../trpc/errors.js";

type Database = Pick<
  Prisma.TransactionClient,
  "class" | "user" | "semester" | "stage" | "enrollment" | "enrollmentAction"
>;
type ListInput = z.infer<typeof classListInputSchema>;

const classInclude = {
  teacher: { select: { id: true, name: true } },
  semester: { select: { id: true, name: true } },
  sharedStage: { select: { id: true, name: true } },
  scheduleSlots: {
    where: { deletedAt: null },
    select: { id: true, weekday: true, startTime: true, endTime: true },
    orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
  },
} satisfies Prisma.ClassInclude;

type ClassBase = Prisma.ClassGetPayload<{ include: typeof classInclude }>;
type Page<Row> = { rows: Row[]; page: number; pageSize: number; pageCount: number; total: number };
function currentEnrollmentWhere(today: Date): Prisma.EnrollmentWhereInput {
  return {
    deletedAt: null,
    entryDate: { lte: today },
    OR: [{ exitDate: null }, { exitDate: { gt: today } }],
    actions: {
      none: { status: "SCHEDULED", kind: { in: ["PAUSE", "EXIT"] }, effectiveDate: { lte: today } },
    },
  };
}
function classWhere(values: ListInput): Prisma.ClassWhereInput {
  const { search, scheduleTypes, formats, teacherIds, semesterIds, statuses } = values;
  return {
    deletedAt: null,
    ...(search
      ? {
          OR: [
            { internalCode: { contains: search, mode: "insensitive" } },
            { portalClassName: { contains: search, mode: "insensitive" } },
            { teacher: { name: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
    ...(scheduleTypes.length > 0 ? { scheduleType: { in: scheduleTypes } } : {}),
    ...(formats.length > 0 ? { format: { in: formats } } : {}),
    ...(teacherIds.length > 0 ? { teacherId: { in: teacherIds } } : {}),
    ...(semesterIds.length > 0 ? { semesterId: { in: semesterIds } } : {}),
    ...(statuses.length > 0 ? { status: { in: statuses } } : {}),
  };
}
export async function listClasses(input: {
  database: Database;
  values: ListInput;
  now: Date;
}): Promise<Page<ClassBase & { occupancy: number }>> {
  const today = new Date(saoPauloDateOnly(input.now));
  const { page, pageSize } = input.values;
  const where = classWhere(input.values);
  const [rows, total] = await Promise.all([
    input.database.class.findMany({
      where,
      include: {
        ...classInclude,
        _count: {
          select: {
            enrollments: {
              where: currentEnrollmentWhere(today),
            },
          },
        },
      },
      orderBy: [{ internalCode: "asc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    input.database.class.count({ where }),
  ]);
  return {
    rows: rows.map(({ _count, ...row }) => ({ ...row, occupancy: _count.enrollments })),
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    total,
  };
}

export async function readClass(input: {
  database: Database;
  id: string;
  now: Date;
}): Promise<ClassBase & { occupancy: number; scheduledEntries: number }> {
  const row = await input.database.class.findFirst({
    where: { id: input.id, deletedAt: null },
    include: {
      ...classInclude,
    },
  });
  if (row === null) throw notFound(CLASS_NOT_FOUND_MESSAGE);
  const today = new Date(saoPauloDateOnly(input.now));
  const [occupancy, scheduledEntries] = await Promise.all([
    input.database.enrollment.count({
      where: { classId: input.id, ...currentEnrollmentWhere(today) },
    }),
    input.database.enrollment.count({
      where: { classId: input.id, deletedAt: null, entryDate: { gt: today } },
    }),
  ]);
  return {
    ...row,
    occupancy,
    scheduledEntries,
  };
}

const rosterSelect = {
  id: true,
  studentId: true,
  entryDate: true,
  exitDate: true,
  exitReason: true,
  student: { select: { fullName: true } },
  progressRecords: {
    where: { deletedAt: null },
    select: { stage: { select: { name: true } } },
    orderBy: { startDate: "desc" },
    take: 1,
  },
  actions: {
    where: { status: "SCHEDULED", kind: { in: ["PAUSE", "EXIT"] } },
    select: { effectiveDate: true, kind: true },
    take: 1,
  },
} satisfies Prisma.EnrollmentSelect;
type RosterInput = {
  database: Database;
  id: string;
  page: number;
  pageSize: number;
  search: string;
  situations: Array<"CURRENT" | "SCHEDULED" | "PAUSED" | "ENDED">;
  now: Date;
};
function rosterWhere(input: RosterInput, today: Date): Prisma.EnrollmentWhereInput {
  const situations: Record<RosterInput["situations"][number], Prisma.EnrollmentWhereInput> = {
    CURRENT: currentEnrollmentWhere(today),
    SCHEDULED: { entryDate: { gt: today } },
    PAUSED: { exitReason: "SUSPENDED", exitDate: { lte: today } },
    ENDED: {
      exitReason: { in: ["DROPPED", "COMPLETED", "TRANSFERRED", "CORRECTION"] },
      exitDate: { lte: today },
    },
  };
  return {
    classId: input.id,
    deletedAt: null,
    ...(input.search
      ? { student: { fullName: { contains: input.search, mode: "insensitive" } } }
      : {}),
    ...(input.situations.length > 0
      ? { OR: input.situations.map((value) => situations[value]) }
      : {}),
  };
}
export async function listClassRoster(
  input: RosterInput,
): Promise<Page<Prisma.EnrollmentGetPayload<{ select: typeof rosterSelect }>> & { today: string }> {
  const exists = await input.database.class.count({ where: { id: input.id, deletedAt: null } });
  if (exists === 0) throw notFound(CLASS_NOT_FOUND_MESSAGE);
  const today = new Date(saoPauloDateOnly(input.now));
  const where = rosterWhere(input, today);
  const [rows, total] = await Promise.all([
    input.database.enrollment.findMany({
      where,
      select: rosterSelect,
      orderBy: [{ entryDate: "desc" }, { id: "asc" }],
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    input.database.enrollment.count({ where }),
  ]);
  return {
    rows,
    page: input.page,
    pageSize: input.pageSize,
    pageCount: Math.max(1, Math.ceil(total / input.pageSize)),
    total,
    today: saoPauloDateOnly(input.now),
  };
}

const actionSelect = {
  id: true,
  kind: true,
  status: true,
  effectiveDate: true,
  previousDate: true,
  justification: true,
  createdAt: true,
  cancelledAt: true,
  correctionOfId: true,
  recordedBy: { select: { name: true } },
  cancelledBy: { select: { name: true } },
  enrollment: { select: { student: { select: { fullName: true } } } },
} satisfies Prisma.EnrollmentActionSelect;
export async function listClassActions(input: {
  database: Database;
  id: string;
  page: number;
  pageSize: number;
}): Promise<Page<Prisma.EnrollmentActionGetPayload<{ select: typeof actionSelect }>>> {
  const exists = await input.database.class.count({ where: { id: input.id, deletedAt: null } });
  if (exists === 0) throw notFound(CLASS_NOT_FOUND_MESSAGE);
  const where: Prisma.EnrollmentActionWhereInput = { enrollment: { classId: input.id } };
  const [rows, total] = await Promise.all([
    input.database.enrollmentAction.findMany({
      where,
      select: actionSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    input.database.enrollmentAction.count({ where }),
  ]);
  return {
    rows,
    page: input.page,
    pageSize: input.pageSize,
    pageCount: Math.max(1, Math.ceil(total / input.pageSize)),
    total,
  };
}

export async function classFormOptions(database: Database): Promise<{
  teachers: Array<{ id: string; name: string }>;
  semesters: Array<{ id: string; name: string }>;
  stages: Array<{ id: string; name: string; internalCode: string }>;
}> {
  const [teachers, semesters, stages] = await Promise.all([
    database.user.findMany({
      where: { role: "TEACHER", isEnabled: true, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    database.semester.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
      orderBy: { startDate: "desc" },
      take: 20,
    }),
    database.stage.findMany({
      where: { deletedAt: null, track: { status: "ACTIVE" } },
      select: { id: true, name: true, internalCode: true },
      orderBy: { internalCode: "asc" },
    }),
  ]);
  return { teachers, semesters, stages };
}
