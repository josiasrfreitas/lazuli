import { searchIds } from "../search.js";
import type { Prisma, TransactionClient } from "@lazuli/db";
import { saoPauloDateOnly } from "@lazuli/domain";
import type { classListInputSchema, z } from "@lazuli/validators";
import {
  assignedTeacherIdOn,
  responsibilitySelect,
  usualTeacherOn,
} from "../teachers/responsibility.js";
import { teacherIdentityWhere } from "../teachers/identity.js";
import { CLASS_NOT_FOUND_MESSAGE } from "./errors.js";
import { notFound } from "../trpc/errors.js";
import { computeEnrollmentPercentInWindow } from "../attendance/percent.js";

type Database = Pick<
  TransactionClient,
  | "$queryRaw"
  | "$kysely"
  | "class"
  | "user"
  | "period"
  | "stage"
  | "enrollment"
  | "enrollmentAction"
  | "classSession"
  | "attendance"
  | "makeup"
  | "classSessionRecord"
  | "attendanceWindow"
>;
type ListInput = z.infer<typeof classListInputSchema>;

const classInclude = {
  teacher: responsibilitySelect.teacher,
  teacherAssignments: responsibilitySelect.teacherAssignments,
  semester: { select: { id: true, name: true } },
  sharedStage: { select: { id: true, name: true, track: { select: { name: true } } } },
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
  const { scheduleTypes, formats, stageIds, semesterIds, statuses } = values;
  return {
    deletedAt: null,
    ...(scheduleTypes.length > 0 ? { scheduleType: { in: scheduleTypes } } : {}),
    ...(formats.length > 0 ? { format: { in: formats } } : {}),
    ...(stageIds.length > 0
      ? { AND: [{ scheduleType: "REGULAR", sharedStageId: { in: stageIds } }] }
      : {}),
    ...(semesterIds.length > 0 ? { semesterId: { in: semesterIds } } : {}),
    ...(statuses.length > 0 ? { status: { in: statuses } } : {}),
  };
}
export async function listClasses(
  input: ListClassesInput,
): Promise<
  Page<ClassBase & { occupancy: number; currentTeacher: { id: string; name: string } | null }>
> {
  const today = new Date(saoPauloDateOnly(input.now));
  const { page, pageSize } = input.values;
  const where = classWhere(input.values);
  await applyClassSearch(input, where);
  await applyClassTeacherFilter({ ...input, today, where });
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
    rows: rows.map(({ _count, ...row }) => ({
      ...row,
      currentTeacher: usualTeacherOn(row, today),
      occupancy: _count.enrollments,
    })),
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    total,
  };
}

export async function readClass(input: ReadClassInput): Promise<
  ClassBase & {
    occupancy: number;
    scheduledEntries: number;
    currentTeacher: { id: string; name: string } | null;
  }
> {
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
    currentTeacher: usualTeacherOn(row, today),
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
  student: { select: { fullName: true, phone: true, birthDate: true } },
  returnActions: {
    where: { kind: "RETURN", status: { in: ["SCHEDULED", "APPLIED"] } },
    select: { id: true },
    take: 1,
  },
  progressRecords: {
    where: { deletedAt: null },
    select: {
      startDate: true,
      endDate: true,
      stage: { select: { name: true, track: { select: { name: true } } } },
      assessment: {
        select: { grades: { where: { deletedAt: null }, select: { score: true } } },
      },
    },
    orderBy: { startDate: "desc" },
  },
  actions: {
    where: { status: "SCHEDULED", kind: { in: ["PAUSE", "EXIT"] } },
    select: { effectiveDate: true, kind: true },
    take: 1,
  },
} satisfies Prisma.EnrollmentSelect;
type RosterRow = Prisma.EnrollmentGetPayload<{ select: typeof rosterSelect }>;
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
    ...(input.situations.length > 0
      ? { OR: input.situations.map((value) => situations[value]) }
      : {}),
  };
}
export async function listClassRoster(input: RosterInput): Promise<
  Page<
    Prisma.EnrollmentGetPayload<{ select: typeof rosterSelect }> & {
      gradeAverage: number | null;
      attendancePercent: number | null;
    }
  > & { today: string }
> {
  const classRow = await input.database.class.findFirst({
    where: { id: input.id, deletedAt: null },
    select: { semester: { select: { startDate: true, endDate: true } } },
  });
  if (classRow === null) throw notFound(CLASS_NOT_FOUND_MESSAGE);
  const today = new Date(saoPauloDateOnly(input.now));
  const where = rosterWhere(input, today);
  where.student = {
    id: (await searchIds(input.database, { table: "Student", query: input.search })) ?? {},
  };
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
    rows: await Promise.all(
      rows.map((row) => enrichRosterRow(input, { row, semester: classRow.semester, today })),
    ),
    page: input.page,
    pageSize: input.pageSize,
    pageCount: Math.max(1, Math.ceil(total / input.pageSize)),
    total,
    today: saoPauloDateOnly(input.now),
  };
}

async function enrichRosterRow(
  input: RosterInput,
  {
    row,
    semester,
    today,
  }: {
    row: RosterRow;
    semester: { startDate: Date; endDate: Date };
    today: Date;
  },
): Promise<RosterRow & { gradeAverage: number | null; attendancePercent: number | null }> {
  const currentProgress = row.progressRecords.find(
    (progress) => progress.startDate <= today && (!progress.endDate || progress.endDate >= today),
  );
  const grades = currentProgress?.assessment?.grades ?? [];
  const attendance = await computeEnrollmentPercentInWindow({
    database: input.database,
    values: { enrollment: { ...row, classId: input.id }, semester },
  });
  return {
    ...row,
    gradeAverage:
      grades.length > 0
        ? grades.reduce((sum, grade) => sum + Number(grade.score), 0) / grades.length
        : null,
    attendancePercent: attendance.percent,
  };
}

async function applyClassSearch(
  input: ListClassesInput,
  where: Prisma.ClassWhereInput,
): Promise<void> {
  if (!input.values.search) return;
  const [classes, teachers] = await Promise.all([
    searchIds(input.database, { table: "Class", query: input.values.search }),
    searchIds(input.database, { table: "User", query: input.values.search }),
  ]);
  if (classes && teachers)
    where.OR = [
      { id: classes },
      { teacher: { id: teachers } },
      { teacherAssignments: { some: { teacher: { id: teachers } } } },
    ];
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
export async function listClassActions(
  input: ListClassActionsInput,
): Promise<Page<Prisma.EnrollmentActionGetPayload<{ select: typeof actionSelect }>>> {
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
  filterTeachers: Array<{ id: string; name: string }>;
  semesters: Array<{ id: string; name: string; startDate: Date; endDate: Date }>;
  stages: Array<{ id: string; name: string; internalCode: string }>;
}> {
  const [teachers, filterTeachers, semesters, stages] = await Promise.all([
    database.user.findMany({
      where: {
        AND: [teacherIdentityWhere],
        deletedAt: null,
        OR: [
          { teacherProfile: null },
          { teacherProfile: { departureDate: null } },
          { teacherProfile: { departureDate: { gt: new Date(saoPauloDateOnly(new Date())) } } },
        ],
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    database.user.findMany({
      where: { AND: [teacherIdentityWhere], deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    database.period.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, startDate: true, endDate: true },
      orderBy: { startDate: "desc" },
      take: 20,
    }),
    database.stage.findMany({
      where: { deletedAt: null, track: { status: "ACTIVE" } },
      select: { id: true, name: true, internalCode: true },
      orderBy: { internalCode: "asc" },
    }),
  ]);
  return { teachers, filterTeachers, semesters, stages };
}

async function applyClassTeacherFilter(input: ApplyClassTeacherFilterInput): Promise<void> {
  const { where, today } = input;
  if (input.values.teacherIds.length > 0) {
    const candidates = await input.database.class.findMany({
      where,
      select: { id: true, ...responsibilitySelect },
    });
    where.id = {
      in: candidates
        .filter((row) => {
          const teacherId = assignedTeacherIdOn(row, today);
          return teacherId !== null && input.values.teacherIds.includes(teacherId);
        })
        .map((row) => row.id),
    };
  }
}

type ListClassesInput = {
  database: Database;
  values: ListInput;
  now: Date;
};
type ReadClassInput = { database: Database; id: string; now: Date };
type ListClassActionsInput = {
  database: Database;
  id: string;
  page: number;
  pageSize: number;
};
type ApplyClassTeacherFilterInput = {
  database: Database;
  values: ListInput;
  today: Date;
  where: Prisma.ClassWhereInput;
};
