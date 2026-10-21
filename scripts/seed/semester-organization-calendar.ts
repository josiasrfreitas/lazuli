import type { Semester } from "../../packages/db/src/index.js";
import type { TransactionClient } from "../../packages/db/src/client.js";
import {
  addDays,
  isoOf,
  stableUuid,
  timeOfDay,
  utcDate,
} from "../../packages/db/src/seed-dev-support.js";
import { brazilFederalHolidaysForYear } from "../../packages/domain/src/brazil-federal-holidays.js";
import { CLASS_REFERENCE_CAPACITY } from "../../packages/domain/src/class-occupancy.js";
import { planClassSessionRows } from "../../packages/worker-handlers/src/sessions/generate.js";
import {
  resolvePersonalizedPortalClassName,
  resolveRegularPortalClassName,
} from "../../packages/api/src/classes/portal-name.js";
import {
  assertNoTeacherConflict,
  assertTeacherEligible,
} from "../../packages/api/src/teachers/availability.js";
import { organizationId, type OrganizationGroup } from "./semester-organization-data.js";

const ISO_TIME_START_INDEX = 11;
const ISO_MINUTE_END_INDEX = 16;

export async function organizationSemester(
  database: TransactionClient,
  authoredAt: Date,
  adminId: string,
): Promise<Semester> {
  const current = await database.class.findUniqueOrThrow({
    where: { id: stableUuid(["class", "MWYA"]) },
    include: { semester: true },
  });
  const startDate = addDays(current.semester.endDate, 1);
  const year = startDate.getUTCFullYear();
  const half = startDate.getUTCMonth() < 6 ? 1 : 2;
  const name = `${year}.${half}`;
  const semester = await database.semester.create({
    data: {
      id: organizationId("window", { semesterName: name, key: "semester" }),
      name,
      startDate,
      endDate: utcDate(`${year}-${half === 1 ? "06-30" : "12-31"}`),
      createdAt: authoredAt,
      updatedAt: authoredAt,
    },
  });
  // Use the same known federal closures as the existing calendar. Local/movable holidays are not inferred.
  for (const holiday of brazilFederalHolidaysForYear(year)) {
    if (holiday.date < isoOf(startDate) || holiday.date > isoOf(semester.endDate)) continue;
    await database.schoolClosedDay.upsert({
      where: { date: utcDate(holiday.date) },
      update: {},
      create: {
        id: stableUuid(["closed-day", holiday.date]),
        date: utcDate(holiday.date),
        reason: holiday.reason,
        createdById: adminId,
        createdAt: authoredAt,
        updatedAt: authoredAt,
      },
    });
  }
  return semester;
}

/** A published group is operational; a draft never reserves a teacher or creates sessions. */
export async function publishedOrganizationClass(input: {
  database: TransactionClient;
  semester: Semester;
  group: OrganizationGroup;
  teacherId: string;
  stageId: string | null;
  previousClassId: string | null;
  adminId: string;
  publishedAt: Date;
}): Promise<{ id: string; portalClassName: string }> {
  const { database, semester, group, teacherId, publishedAt } = input;
  await assertTeacherEligible({ database, teacherId, date: isoOf(semester.startDate) });
  await assertNoTeacherConflict({
    database,
    teacherId,
    from: isoOf(semester.startDate),
    through: isoOf(semester.endDate),
    slots: group.slots,
  });
  const naming = {
    database,
    slots: group.slots,
    semesterName: semester.name,
    year: semester.startDate.getUTCFullYear(),
  };
  const portalClassName =
    group.scheduleType === "PERSONALIZED"
      ? await resolvePersonalizedPortalClassName(naming)
      : await resolveRegularPortalClassName({ ...naming, stageInternalCode: group.stageCode! });
  const id = organizationId("class", { semesterName: semester.name, key: group.key });
  await database.class.create({
    data: {
      id,
      internalCode: `${semester.name}-SEED-${group.key.toUpperCase()}`,
      portalClassName,
      originalPortalClassName: portalClassName,
      teacherId,
      scheduleType: group.scheduleType,
      format: group.format,
      sharedStageId: input.stageId,
      semesterId: semester.id,
      year: semester.startDate.getUTCFullYear(),
      capacity: CLASS_REFERENCE_CAPACITY,
      previousClassId: input.previousClassId,
      createdAt: publishedAt,
      updatedAt: publishedAt,
      scheduleSlots: {
        create: group.slots.map((slot) => ({
          id: organizationId("slot", {
            semesterName: semester.name,
            key: `${group.key}/${slot.weekday}`,
          }),
          weekday: slot.weekday,
          startTime: timeOfDay(slot.startTime),
          endTime: timeOfDay(slot.endTime),
          createdAt: publishedAt,
          updatedAt: publishedAt,
        })),
      },
    },
  });
  await database.classTeacherAssignment.create({
    data: {
      id: organizationId("teacher-assignment", { semesterName: semester.name, key: group.key }),
      classId: id,
      teacherId,
      effectiveDate: semester.startDate,
      recordedById: input.adminId,
      recordedAt: publishedAt,
      createdAt: publishedAt,
      updatedAt: publishedAt,
    },
  });
  const classroom = await database.class.findUniqueOrThrow({
    where: { id },
    include: { semester: true, scheduleSlots: true },
  });
  const [closures, semesters] = await Promise.all([
    database.schoolClosedDay.findMany({ where: { deletedAt: null }, select: { date: true } }),
    database.semester.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, startDate: true, endDate: true },
    }),
  ]);
  // Bootstrap materializes calendar rows with the production pure planner; no fictitious worker request.
  const sessions = planClassSessionRows({
    classes: [classroom],
    semesters,
    closedDates: new Set(closures.map((row) => isoOf(row.date))),
  });
  await database.classSession.createMany({
    data: sessions.map((row) => ({
      ...row,
      id: stableUuid([
        "session",
        row.classId,
        isoOf(row.date),
        row.startTime.toISOString().slice(ISO_TIME_START_INDEX, ISO_MINUTE_END_INDEX),
      ]),
      createdAt: publishedAt,
      updatedAt: publishedAt,
    })),
  });
  return { id, portalClassName };
}
