import { CLASS_REFERENCE_CAPACITY } from "@lazuli/domain";
import { generateClassInternalCode } from "./internal-code.js";
import type { Prisma } from "@lazuli/db";
import type { classCreateInputSchema, z } from "@lazuli/validators";

import { assertClassTeacherAvailable } from "../teachers/availability.js";
import { notFound } from "../trpc/errors.js";
import { CLASS_NOT_FOUND_MESSAGE } from "./errors.js";
import { assertTeacherIsActive, loadActiveStage, loadSemester } from "./guards.js";
import {
  resolvePersonalizedPortalClassName,
  resolveRegularPortalClassName,
} from "./portal-name.js";
import { timeStringToDate } from "./time.js";

type ClassCreateInput = z.infer<typeof classCreateInputSchema>;
export type ClassDatabase = Prisma.TransactionClient;

export type ClassSummary = {
  id: string;
  internalCode: string;
  portalClassName: string;
  status: "ACTIVE" | "ARCHIVED";
  previousClassId: string | null;
  sharedStageId: string | null;
};

export const classSummarySelect = {
  id: true,
  internalCode: true,
  portalClassName: true,
  status: true,
  previousClassId: true,
  sharedStageId: true,
} as const;

type SlotRow = {
  weekday: ClassCreateInput["slots"][number]["weekday"];
  startTime: Date;
  endTime: Date;
};

export async function createClass(input: {
  database: ClassDatabase;
  values: ClassCreateInput;
  recordedById?: string;
}): Promise<ClassSummary> {
  await assertTeacherIsActive({ database: input.database, teacherId: input.values.teacherId });

  await assertClassTeacherAvailable({
    database: input.database,
    teacherId: input.values.teacherId,
    semesterId: input.values.semesterId ?? "",
    slots: input.values.slots,
  });
  const slotRows = input.values.slots.map((slot) => toSlotRow(slot));

  const created =
    input.values.scheduleType === "REGULAR"
      ? await createRegularClass({ database: input.database, values: input.values, slotRows })
      : await createPersonalizedClass({ database: input.database, values: input.values, slotRows });
  await recordInitialTeacher(input.database, created.id, input.recordedById);
  return created;
}

async function createRegularClass(input: {
  database: ClassDatabase;
  values: ClassCreateInput;
  slotRows: SlotRow[];
}): Promise<ClassSummary> {
  const stage = await loadActiveStage({
    database: input.database,
    stageId: input.values.sharedStageId ?? "",
  });
  const semester = await loadSemester({
    database: input.database,
    semesterId: input.values.semesterId ?? "",
  });

  const portalClassName = await resolveRegularPortalClassName({
    database: input.database,
    stageInternalCode: stage.internalCode,
    slots: input.values.slots,
    semesterName: semester.name,
    year: input.values.year,
  });

  return input.database.class.create({
    data: buildClassCreateData({
      values: input.values,
      portalClassName,
      sharedStageId: stage.id,
      semesterId: semester.id,
      slotRows: input.slotRows,
    }),
    select: classSummarySelect,
  });
}

async function createPersonalizedClass(input: {
  database: ClassDatabase;
  values: ClassCreateInput;
  slotRows: SlotRow[];
}): Promise<ClassSummary> {
  const semester = await loadSemester({
    database: input.database,
    semesterId: input.values.semesterId ?? "",
  });

  const portalClassName = await resolvePersonalizedPortalClassName({
    database: input.database,
    slots: input.values.slots,
    semesterName: semester.name,
    year: input.values.year,
  });

  return input.database.class.create({
    data: buildClassCreateData({
      values: input.values,
      portalClassName,
      sharedStageId: null,
      semesterId: semester.id,
      slotRows: input.slotRows,
    }),
    select: classSummarySelect,
  });
}

function buildClassCreateData(input: {
  values: ClassCreateInput;
  portalClassName: string;
  sharedStageId: string | null;
  semesterId: string;
  slotRows: SlotRow[];
}): Prisma.ClassUncheckedCreateInput {
  return {
    internalCode: generateClassInternalCode(input.values.year),
    teacherId: input.values.teacherId,
    scheduleType: input.values.scheduleType,
    format: input.values.format,
    sharedStageId: input.sharedStageId,
    semesterId: input.semesterId,
    year: input.values.year,
    capacity: CLASS_REFERENCE_CAPACITY,
    portalClassName: input.portalClassName,
    originalPortalClassName: input.portalClassName,
    scheduleSlots: { create: input.slotRows },
  };
}

function toSlotRow(slot: ClassCreateInput["slots"][number]): SlotRow {
  return {
    weekday: slot.weekday,
    startTime: timeStringToDate(slot.startTime),
    endTime: timeStringToDate(slot.endTime),
  };
}

export async function archiveClass(input: {
  database: ClassDatabase;
  id: string;
}): Promise<ClassSummary> {
  const existing = await input.database.class.findUnique({
    where: { id: input.id },
    select: classSummarySelect,
  });

  if (existing === null) {
    throw notFound(CLASS_NOT_FOUND_MESSAGE);
  }

  if (existing.status === "ARCHIVED") {
    return existing;
  }

  return input.database.class.update({
    where: { id: input.id },
    data: { status: "ARCHIVED" },
    select: classSummarySelect,
  });
}

export async function assertGenerationScopeExists(input: {
  database: Pick<ClassDatabase, "class" | "semester">;
  classId?: string;
  semesterId?: string;
}): Promise<void> {
  if (input.classId !== undefined) {
    await assertClassExistsForGeneration({ database: input.database, classId: input.classId });
    return;
  }

  await assertSemesterExistsForGeneration({
    database: input.database,
    semesterId: input.semesterId ?? "",
  });
}

async function assertClassExistsForGeneration(input: {
  database: Pick<ClassDatabase, "class">;
  classId: string;
}): Promise<void> {
  const existing = await input.database.class.findUnique({
    where: { id: input.classId },
    select: { id: true },
  });

  if (existing === null) {
    throw notFound(CLASS_NOT_FOUND_MESSAGE);
  }
}

async function assertSemesterExistsForGeneration(input: {
  database: Pick<ClassDatabase, "semester">;
  semesterId: string;
}): Promise<void> {
  const existing = await input.database.semester.findUnique({
    where: { id: input.semesterId },
    select: { id: true },
  });

  if (existing === null) {
    throw notFound("Semestre nao encontrado.");
  }
}

export async function recordInitialTeacher(
  database: ClassDatabase,
  classId: string,
  recordedById?: string,
): Promise<void> {
  const row = await database.class.findUniqueOrThrow({
    where: { id: classId },
    select: { teacherId: true, semester: { select: { startDate: true } } },
  });
  await database.classTeacherAssignment.create({
    data: {
      classId,
      teacherId: row.teacherId,
      effectiveDate: row.semester.startDate,
      recordedById: recordedById ?? null,
    },
  });
}
