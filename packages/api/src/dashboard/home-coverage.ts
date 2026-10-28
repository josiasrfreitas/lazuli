import type { Prisma } from "@lazuli/db";
import { saoPauloDateOnly } from "@lazuli/domain";
import { responsibilitySelect, usualTeacherOn } from "../teachers/responsibility.js";
import { dateOnly, linkItem, type HomeItem } from "./home-model.js";

const COVERAGE_HORIZON_DAYS = 15;
const TIME_START = 11;
const TIME_END = 16;
const coverageClassSelect = {
  ...responsibilitySelect,
  sharedStage: { select: { name: true } },
  enrollments: { select: { studentId: true } },
  id: true,
  portalClassName: true,
  scheduleType: true,
  semester: { select: { name: true, startDate: true } },
  scheduleSlots: {
    where: { deletedAt: null },
    select: { weekday: true, startTime: true, endTime: true },
    orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
  },
} satisfies Prisma.ClassSelect;
type CoverageClass = Prisma.ClassGetPayload<{ select: typeof coverageClassSelect }>;
const coveragePlanSelect = {
  id: true,
  name: true,
  semesterId: true,
  semester: { select: { name: true, startDate: true } },
} as const;
type CoveragePlan = Prisma.SemesterClassPlanGetPayload<{ select: typeof coveragePlanSelect }>;

/** Current classes need coverage; future semesters enter the queue 15 days before starting. */
export async function readUnassignedClasses(
  database: Prisma.TransactionClient,
  now: Date,
): Promise<HomeItem[]> {
  const today = saoPauloDateOnly(now);
  const horizon = new Date(today);
  horizon.setUTCDate(horizon.getUTCDate() + COVERAGE_HORIZON_DAYS);
  const [classes, plans] = await Promise.all([
    findCoverageClasses(database, { today: new Date(today), horizon }),
    findCoveragePlans(database, { today: new Date(today), horizon }),
  ]);
  const missing = unassignedCoverageClasses(classes, today);
  return [
    ...missing.map((row) =>
      linkItem({
        id: `class:${row.id}`,
        title: row.portalClassName,
        detail: row.scheduleSlots
          .map(
            (slot) =>
              `${WEEKDAYS[slot.weekday]} ${slot.startTime.toISOString().slice(TIME_START, TIME_END)}–${slot.endTime.toISOString().slice(TIME_START, TIME_END)}`,
          )
          .join(" · "),
        stageName:
          row.scheduleType === "PERSONALIZED" ? "PPT" : (row.sharedStage?.name ?? "Sem estágio"),
        studentCount: new Set(row.enrollments.map((enrollment) => enrollment.studentId)).size,
        departedTeacherName: (
          row.teacherAssignments.find((assignment) => dateOnly(assignment.effectiveDate) <= today)
            ?.teacher ?? row.teacher
        ).name,
        href: `/turmas/${row.id}?acao=professor`,
        date: dateOnly(row.semester.startDate) > today ? dateOnly(row.semester.startDate) : null,
      }),
    ),
    ...plans.map((row) =>
      linkItem({
        id: `plan:${row.id}`,
        title: row.name,
        detail: `Turma em preparação · Semestre ${row.semester.name}`,
        href: `/organizacao?semestre=${row.semesterId}&turma=${row.id}`,
        date: dateOnly(row.semester.startDate) > today ? dateOnly(row.semester.startDate) : null,
      }),
    ),
  ];
}

function unassignedCoverageClasses(classes: CoverageClass[], today: string): CoverageClass[] {
  return classes.filter(
    (row) =>
      usualTeacherOn(
        row,
        new Date(
          dateOnly(row.semester.startDate) > today ? dateOnly(row.semester.startDate) : today,
        ),
      ) === null,
  );
}

async function findCoverageClasses(
  database: Prisma.TransactionClient,
  { today, horizon }: { today: Date; horizon: Date },
): Promise<CoverageClass[]> {
  return database.class.findMany({
    where: {
      deletedAt: null,
      status: "ACTIVE",
      semester: { deletedAt: null, startDate: { lte: horizon }, endDate: { gte: today } },
    },
    select: {
      ...coverageClassSelect,
      enrollments: {
        ...coverageClassSelect.enrollments,
        where: {
          deletedAt: null,
          entryDate: { lte: today },
          OR: [{ exitDate: null }, { exitDate: { gt: today } }],
          student: { deletedAt: null },
        },
      },
    },
    orderBy: { portalClassName: "asc" },
  });
}

async function findCoveragePlans(
  database: Prisma.TransactionClient,
  { today, horizon }: { today: Date; horizon: Date },
): Promise<CoveragePlan[]> {
  return database.semesterClassPlan.findMany({
    where: {
      deletedAt: null,
      closedAt: null,
      classId: null,
      teacherId: null,
      semester: { deletedAt: null, startDate: { lte: horizon }, endDate: { gte: today } },
    },
    select: coveragePlanSelect,
    orderBy: [{ semester: { startDate: "asc" } }, { name: "asc" }],
  });
}

const WEEKDAYS: Record<string, string> = {
  MONDAY: "segunda",
  TUESDAY: "terça",
  WEDNESDAY: "quarta",
  THURSDAY: "quinta",
  FRIDAY: "sexta",
  SATURDAY: "sábado",
  SUNDAY: "domingo",
};
