import type { Prisma } from "@lazuli/db";
import { saoPauloDateOnly } from "@lazuli/domain";
import { responsibilitySelect, usualTeacherOn } from "../teachers/responsibility.js";
import { dateOnly, linkItem, type HomeItem } from "./home-model.js";

/** Current classes need coverage; future semesters enter the queue 15 days before starting. */
export async function readUnassignedClasses(
  database: Prisma.TransactionClient,
  now: Date,
): Promise<HomeItem[]> {
  const today = saoPauloDateOnly(now);
  const horizon = new Date(today);
  horizon.setUTCDate(horizon.getUTCDate() + 15);
  const [classes, plans] = await Promise.all([
    database.class.findMany({
      where: {
        deletedAt: null,
        status: "ACTIVE",
        semester: {
          deletedAt: null,
          startDate: { lte: horizon },
          endDate: { gte: new Date(today) },
        },
      },
      select: {
        ...responsibilitySelect,
        sharedStage: { select: { name: true } },
        enrollments: {
          where: {
            deletedAt: null,
            entryDate: { lte: new Date(today) },
            OR: [{ exitDate: null }, { exitDate: { gt: new Date(today) } }],
            student: { deletedAt: null },
          },
          select: { studentId: true },
        },
        id: true,
        portalClassName: true,
        scheduleType: true,
        semester: { select: { name: true, startDate: true } },
        scheduleSlots: {
          where: { deletedAt: null },
          select: { weekday: true, startTime: true, endTime: true },
          orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
        },
      },
      orderBy: { portalClassName: "asc" },
    }),
    database.semesterClassPlan.findMany({
      where: {
        deletedAt: null,
        closedAt: null,
        classId: null,
        teacherId: null,
        semester: {
          deletedAt: null,
          startDate: { lte: horizon },
          endDate: { gte: new Date(today) },
        },
      },
      select: {
        id: true,
        name: true,
        semesterId: true,
        semester: { select: { name: true, startDate: true } },
      },
      orderBy: [{ semester: { startDate: "asc" } }, { name: "asc" }],
    }),
  ]);
  const missing = classes.filter(
    (row) =>
      usualTeacherOn(
        row,
        new Date(
          dateOnly(row.semester.startDate) > today ? dateOnly(row.semester.startDate) : today,
        ),
      ) === null,
  );
  return [
    ...missing.map((row) =>
      linkItem({
        id: `class:${row.id}`,
        title: row.portalClassName,
        detail: row.scheduleSlots
          .map(
            (slot) =>
              `${WEEKDAYS[slot.weekday]} ${slot.startTime.toISOString().slice(11, 16)}–${slot.endTime.toISOString().slice(11, 16)}`,
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

const WEEKDAYS: Record<string, string> = {
  MONDAY: "segunda",
  TUESDAY: "terça",
  WEDNESDAY: "quarta",
  THURSDAY: "quinta",
  FRIDAY: "sexta",
  SATURDAY: "sábado",
  SUNDAY: "domingo",
};
