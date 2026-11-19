import { CLASS_REFERENCE_CAPACITY } from "@lazuli/domain";
import { generateClassInternalCode } from "./internal-code.js";
import type { Prisma } from "@lazuli/db";
import type { classCreateInputSchema, z } from "@lazuli/validators";
import { assertClassTeacherAvailable } from "../teachers/availability.js";
import { notFound } from "../trpc/errors.js";
import { CLASS_NOT_FOUND_MESSAGE } from "./errors.js";
import { loadActiveStage } from "./guards.js";
import { resolvePortalClassName } from "./portal-name.js";
import { timeStringToDate } from "./time.js";

type ClassCreateInput = z.infer<typeof classCreateInputSchema> & { previousClassId?: string };
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

export async function createClass(input: CreateClassInput): Promise<ClassSummary> {
  const semester = await assertClassTeacherAvailable({
    database: input.database,
    teacherId: input.values.teacherId,
    semesterId: input.values.semesterId ?? "",
    startDate: input.values.startDate,
    slots: input.values.slots,
  });
  const slotRows = input.values.slots.map((slot) => toSlotRow(slot));

  const stage =
    input.values.scheduleType === "REGULAR"
      ? await loadActiveStage({
          database: input.database,
          stageId: input.values.sharedStageId ?? "",
        })
      : null;
  const portalClassName = await resolvePortalClassName(input.database, input.values);
  const created = await input.database.class.create({
    data: buildClassCreateData({
      values: input.values,
      portalClassName,
      sharedStageId: stage?.id ?? null,
      semesterId: semester.id,
      year: semester.startDate.getUTCFullYear(),
      slotRows,
    }),
    select: classSummarySelect,
  });
  await recordInitialTeacher({
    database: input.database,
    classId: created.id,
    recordedById: input.recordedById,
  });
  return created;
}

function buildClassCreateData(input: BuildClassCreateDataInput): Prisma.ClassUncheckedCreateInput {
  return {
    internalCode: generateClassInternalCode(input.year),
    teacherId: input.values.teacherId,
    scheduleType: input.values.scheduleType,
    format: input.values.format,
    sharedStageId: input.sharedStageId,
    previousClassId: input.values.previousClassId ?? null,
    semesterId: input.semesterId,
    startDate: new Date(`${input.values.startDate}T00:00:00.000Z`),
    year: input.year,
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

export async function archiveClass(input: ArchiveClassInput): Promise<ClassSummary> {
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

export async function assertGenerationScopeExists(
  input: AssertGenerationScopeExistsInput,
): Promise<void> {
  if (input.classId !== undefined) {
    await assertClassExistsForGeneration({ database: input.database, classId: input.classId });
    return;
  }

  await assertSemesterExistsForGeneration({
    database: input.database,
    semesterId: input.semesterId ?? "",
  });
}

async function assertClassExistsForGeneration(
  input: AssertClassExistsForGenerationInput,
): Promise<void> {
  const existing = await input.database.class.findUnique({
    where: { id: input.classId },
    select: { id: true },
  });

  if (existing === null) {
    throw notFound(CLASS_NOT_FOUND_MESSAGE);
  }
}

async function assertSemesterExistsForGeneration(
  input: AssertSemesterExistsForGenerationInput,
): Promise<void> {
  const existing = await input.database.period.findUnique({
    where: { id: input.semesterId },
    select: { id: true },
  });

  if (existing === null) {
    throw notFound("Semestre nao encontrado.");
  }
}

export async function recordInitialTeacher({
  database,
  classId,
  recordedById,
}: RecordInitialTeacherInput): Promise<void> {
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

type CreateClassInput = {
  database: ClassDatabase;
  values: ClassCreateInput;
  recordedById?: string | undefined;
};
type BuildClassCreateDataInput = {
  year: number;
  values: ClassCreateInput;
  portalClassName: string;
  sharedStageId: string | null;
  semesterId: string;
  slotRows: SlotRow[];
};
type ArchiveClassInput = {
  database: ClassDatabase;
  id: string;
};
type AssertGenerationScopeExistsInput = {
  database: Pick<ClassDatabase, "class" | "period">;
  classId?: string;
  semesterId?: string;
};
type AssertClassExistsForGenerationInput = {
  database: Pick<ClassDatabase, "class">;
  classId: string;
};
type AssertSemesterExistsForGenerationInput = {
  database: Pick<ClassDatabase, "period">;
  semesterId: string;
};
type RecordInitialTeacherInput = {
  database: ClassDatabase;
  classId: string;
  recordedById?: string | undefined;
};
