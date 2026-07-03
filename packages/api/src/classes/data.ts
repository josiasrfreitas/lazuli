import type { Prisma } from "@lazuli/db";
import type { classCreateInputSchema, z } from "@lazuli/validators";

import { CLASS_NOT_FOUND_MESSAGE, notFound } from "./errors.js";
import { assertTeacherIsActive, loadActiveStage, loadSemester } from "./guards.js";
import {
  assertActivePortalClassNameAvailable,
  resolveRegularPortalClassName,
} from "./portal-name.js";
import { timeStringToDate } from "./time.js";

type ClassCreateInput = z.infer<typeof classCreateInputSchema>;
export type ClassDatabase = Pick<
  Prisma.TransactionClient,
  "class" | "user" | "stage" | "semester" | "track"
>;

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
}): Promise<ClassSummary> {
  await assertTeacherIsActive({ database: input.database, teacherId: input.values.teacherId });

  const slotRows = input.values.slots.map((slot) => toSlotRow(slot));

  if (input.values.scheduleType === "REGULAR") {
    return createRegularClass({ database: input.database, values: input.values, slotRows });
  }

  return createPersonalizedClass({ database: input.database, values: input.values, slotRows });
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
  const portalClassName = input.values.portalClassName ?? "";
  await assertActivePortalClassNameAvailable({
    database: input.database,
    portalClassName,
  });

  return input.database.class.create({
    data: buildClassCreateData({
      values: input.values,
      portalClassName,
      sharedStageId: null,
      semesterId: input.values.semesterId ?? null,
      slotRows: input.slotRows,
    }),
    select: classSummarySelect,
  });
}

function buildClassCreateData(input: {
  values: ClassCreateInput;
  portalClassName: string;
  sharedStageId: string | null;
  semesterId: string | null;
  slotRows: SlotRow[];
}): Prisma.ClassUncheckedCreateInput {
  return {
    internalCode: input.values.internalCode,
    teacherId: input.values.teacherId,
    scheduleType: input.values.scheduleType,
    format: input.values.format,
    sharedStageId: input.sharedStageId,
    semesterId: input.semesterId,
    year: input.values.year,
    capacity: input.values.capacity,
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
