import type { Prisma } from "@lazuli/db";
import { findNextStageInTrack } from "@lazuli/domain";

import { archiveClass, classSummarySelect, type ClassDatabase, type ClassSummary } from "./data.js";
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
import { dateToTimeString } from "./time.js";

const sourceClassInclude = {
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
} satisfies Prisma.ClassInclude;

type SourceClass = Prisma.ClassGetPayload<{ include: typeof sourceClassInclude }>;

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
    ...optionalSharedStageIdOverride(input.sharedStageId),
  });
  const portalClassName = await resolveClonePortalClassName({
    database: input.database,
    source,
    successorStageId,
    semesterName: semester.name,
    year: input.year,
    ...optionalPortalClassName(input.portalClassName),
  });

  const successor = await input.database.class.create({
    data: buildSuccessorCreateData({
      input,
      source,
      successorStageId,
      semesterId: semester.id,
      portalClassName,
    }),
    select: classSummarySelect,
  });

  const archivedSource = await archiveClass({ database: input.database, id: source.id });
  return { source: archivedSource, successor };
}

async function loadSourceClass(database: ClassDatabase, id: string): Promise<SourceClass> {
  const source = await database.class.findUnique({
    where: { id },
    include: sourceClassInclude,
  });

  if (source === null) {
    throw notFound(CLASS_NOT_FOUND_MESSAGE);
  }

  return source;
}

async function resolveClonePortalClassName(input: {
  database: ClassDatabase;
  source: SourceClass;
  successorStageId: string | null;
  semesterName: string;
  year: number;
  portalClassName?: string;
}): Promise<string> {
  if (input.source.scheduleType === "PERSONALIZED") {
    return resolvePersonalizedClonePortalClassName(input);
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

async function resolvePersonalizedClonePortalClassName(input: {
  database: ClassDatabase;
  portalClassName?: string;
}): Promise<string> {
  if (input.portalClassName === undefined) {
    throw badRequest("Turma personalizada exige nome Portal manual ao clonar.");
  }
  await assertActivePortalClassNameAvailable({
    database: input.database,
    portalClassName: input.portalClassName,
  });
  return input.portalClassName;
}

async function resolveSuccessorStageId(input: {
  database: ClassDatabase;
  source: SourceClass;
  sharedStageIdOverride?: string;
}): Promise<string | null> {
  if (input.source.scheduleType === "PERSONALIZED") {
    return null;
  }

  if (typeof input.sharedStageIdOverride === "string") {
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

function buildSuccessorCreateData(input: {
  input: { internalCode: string; year: number };
  source: SourceClass;
  successorStageId: string | null;
  semesterId: string;
  portalClassName: string;
}): Prisma.ClassUncheckedCreateInput {
  return {
    internalCode: input.input.internalCode,
    teacherId: input.source.teacherId,
    scheduleType: input.source.scheduleType,
    format: input.source.format,
    sharedStageId: input.successorStageId,
    semesterId: input.semesterId,
    year: input.input.year,
    capacity: input.source.capacity,
    previousClassId: input.source.id,
    portalClassName: input.portalClassName,
    scheduleSlots: {
      create: input.source.scheduleSlots.map((slot) => ({
        weekday: slot.weekday,
        startTime: slot.startTime,
        endTime: slot.endTime,
      })),
    },
  };
}

function optionalSharedStageIdOverride(sharedStageId: string | undefined): {
  sharedStageIdOverride?: string;
} {
  return typeof sharedStageId === "string" ? { sharedStageIdOverride: sharedStageId } : {};
}

function optionalPortalClassName(portalClassName: string | undefined): {
  portalClassName?: string;
} {
  return typeof portalClassName === "string" ? { portalClassName } : {};
}
