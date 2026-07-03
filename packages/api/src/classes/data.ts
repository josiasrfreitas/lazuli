import type { Prisma } from "@lazuli/db";
import { findNextStageInTrack } from "@lazuli/domain";
import type { classCreateInputSchema, z } from "@lazuli/validators";

import {
  CLASS_NOT_ACTIVE_MESSAGE,
  CLASS_NOT_FOUND_MESSAGE,
  END_OF_TRACK_MESSAGE,
  STAGE_NOT_FOUND_MESSAGE,
  badRequest,
  notFound,
} from "./errors.js";
import { assertTeacherIsActive, loadActiveStage, loadSemester } from "./guards.js";
import {
  assertActivePortalClassNameAvailable,
  resolveRegularPortalClassName,
} from "./portal-name.js";
import { dateToTimeString, timeStringToDate } from "./time.js";

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

const classSummarySelect = {
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

export async function cloneClassForNextPeriod(input: {
  database: ClassDatabase;
  id: string;
  internalCode: string;
  semesterId: string;
  year: number;
  sharedStageId?: string;
  portalClassName?: string;
}): Promise<{ source: ClassSummary; successor: ClassSummary }> {
  const source = await loadSourceClass(input.database, input.id);

  if (source.status !== "ACTIVE") {
    throw badRequest(CLASS_NOT_ACTIVE_MESSAGE);
  }

  await assertTeacherIsActive({ database: input.database, teacherId: source.teacherId });

  const semester = await loadSemester({ database: input.database, semesterId: input.semesterId });
  const successorStageId = await resolveSuccessorStageId({
    database: input.database,
    source,
    ...(input.sharedStageId !== undefined
      ? { sharedStageIdOverride: input.sharedStageId }
      : {}),
  });
  const portalClassName = await resolveClonePortalClassName({
    database: input.database,
    source,
    successorStageId,
    semesterName: semester.name,
    year: input.year,
    ...(input.portalClassName !== undefined ? { portalClassName: input.portalClassName } : {}),
  });

  const successor = await input.database.class.create({
    data: {
      internalCode: input.internalCode,
      teacherId: source.teacherId,
      scheduleType: source.scheduleType,
      format: source.format,
      sharedStageId: successorStageId,
      semesterId: semester.id,
      year: input.year,
      capacity: source.capacity,
      previousClassId: source.id,
      portalClassName,
      originalPortalClassName: portalClassName,
      scheduleSlots: {
        create: source.scheduleSlots.map((slot) => ({
          weekday: slot.weekday,
          startTime: slot.startTime,
          endTime: slot.endTime,
        })),
      },
    },
    select: classSummarySelect,
  });

  const archivedSource = await archiveClass({ database: input.database, id: source.id });
  return { source: archivedSource, successor };
}

async function loadSourceClass(database: ClassDatabase, id: string) {
  const source = await database.class.findUnique({
    where: { id },
    include: {
      scheduleSlots: {
        where: { deletedAt: null },
        orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
      },
      sharedStage: {
        include: {
          track: {
            include: {
              stages: {
                where: { deletedAt: null },
                orderBy: { sequence: "asc" },
              },
            },
          },
        },
      },
    },
  });

  if (source === null) {
    throw notFound(CLASS_NOT_FOUND_MESSAGE);
  }

  return source;
}

async function resolveClonePortalClassName(input: {
  database: ClassDatabase;
  source: Awaited<ReturnType<typeof loadSourceClass>>;
  successorStageId: string | null;
  semesterName: string;
  year: number;
  portalClassName?: string;
}): Promise<string> {
  if (input.source.scheduleType === "PERSONALIZED") {
    if (input.portalClassName === undefined) {
      throw badRequest("Turma personalizada exige nome Portal manual ao clonar.");
    }
    await assertActivePortalClassNameAvailable({
      database: input.database,
      portalClassName: input.portalClassName,
    });
    return input.portalClassName;
  }

  const successorStage = await loadActiveStage({
    database: input.database,
    stageId: input.successorStageId ?? "",
  });

  return resolveRegularPortalClassName({
    database: input.database,
    stageInternalCode: successorStage.internalCode,
    slots: input.source.scheduleSlots.map((slot) => ({
      weekday: slot.weekday,
      startTime: dateToTimeString(slot.startTime),
      endTime: dateToTimeString(slot.endTime),
    })),
    semesterName: input.semesterName,
    year: input.year,
  });
}

async function resolveSuccessorStageId(input: {
  database: ClassDatabase;
  source: Awaited<ReturnType<typeof loadSourceClass>>;
  sharedStageIdOverride?: string;
}): Promise<string | null> {
  if (input.source.scheduleType === "PERSONALIZED") {
    return null;
  }

  if (input.sharedStageIdOverride !== undefined) {
    const stage = await loadActiveStage({
      database: input.database,
      stageId: input.sharedStageIdOverride,
    });
    return stage.id;
  }

  if (input.source.sharedStage === null) {
    throw badRequest(STAGE_NOT_FOUND_MESSAGE);
  }

  const nextStage = findNextStageInTrack({
    stages: input.source.sharedStage.track.stages,
    currentStageId: input.source.sharedStage.id,
  });

  if (nextStage === null) {
    throw badRequest(END_OF_TRACK_MESSAGE);
  }

  return nextStage.id;
}
