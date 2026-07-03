import type { Prisma } from "@lazuli/db";

import {
  LEGACY_TRACK_MESSAGE,
  SEMESTER_NOT_FOUND_MESSAGE,
  STAGE_NOT_FOUND_MESSAGE,
  TEACHER_INVALID_MESSAGE,
  badRequest,
  notFound,
} from "./errors.js";

type GuardDatabase = Pick<Prisma.TransactionClient, "user" | "stage" | "semester" | "track">;

export async function assertTeacherIsActive(input: {
  database: GuardDatabase;
  teacherId: string;
}): Promise<void> {
  const teacher = await input.database.user.findUnique({
    where: { id: input.teacherId },
    select: { role: true, isEnabled: true },
  });

  if (teacher === null || teacher.role !== "TEACHER" || !teacher.isEnabled) {
    throw badRequest(TEACHER_INVALID_MESSAGE);
  }
}

export async function loadActiveStage(input: {
  database: GuardDatabase;
  stageId: string;
}): Promise<{ id: string; internalCode: string; trackId: string }> {
  const stage = await input.database.stage.findUnique({
    where: { id: input.stageId },
    select: {
      id: true,
      internalCode: true,
      trackId: true,
      track: { select: { status: true } },
    },
  });

  if (stage === null) {
    throw notFound(STAGE_NOT_FOUND_MESSAGE);
  }

  if (stage.track.status === "LEGACY") {
    throw badRequest(LEGACY_TRACK_MESSAGE);
  }

  return {
    id: stage.id,
    internalCode: stage.internalCode,
    trackId: stage.trackId,
  };
}

export async function loadSemester(input: {
  database: GuardDatabase;
  semesterId: string;
}): Promise<{ id: string; name: string }> {
  const semester = await input.database.semester.findUnique({
    where: { id: input.semesterId },
    select: { id: true, name: true },
  });

  if (semester === null) {
    throw notFound(SEMESTER_NOT_FOUND_MESSAGE);
  }

  return semester;
}
