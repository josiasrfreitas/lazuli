import type { Prisma } from "@lazuli/db";

import type { AttendanceDatabase } from "./data.js";
import {
  MAKEUP_NOT_FOUND_MESSAGE,
  ORIGIN_ENROLLMENT_NOT_FOUND_MESSAGE,
  notFound,
} from "./makeup-errors.js";

/** The makeup service touches the same session/enrollment tables plus the `makeup` delegate. */
export type MakeupDatabase = AttendanceDatabase & Pick<Prisma.TransactionClient, "makeup">;

export type OriginEnrollment = {
  id: string;
  classId: string;
  studentFullName: string;
  classInternalCode: string;
};

const originEnrollmentSelect = {
  id: true,
  classId: true,
  student: { select: { fullName: true } },
  class: { select: { internalCode: true } },
} satisfies Prisma.EnrollmentSelect;

/** Loads the student's home enrollment (the makeup origin), or throws the PT-BR not-found error. */
export async function loadOriginEnrollment(input: {
  database: MakeupDatabase;
  enrollmentId: string;
}): Promise<OriginEnrollment> {
  const enrollment = await input.database.enrollment.findUnique({
    where: { id: input.enrollmentId },
    select: originEnrollmentSelect,
  });

  if (enrollment === null) {
    throw notFound(ORIGIN_ENROLLMENT_NOT_FOUND_MESSAGE);
  }
  return {
    id: enrollment.id,
    classId: enrollment.classId,
    studentFullName: enrollment.student.fullName,
    classInternalCode: enrollment.class.internalCode,
  };
}

const makeupWithTargetSelect = {
  id: true,
  cancelledAt: true,
  attendedAt: true,
  targetClassSession: {
    select: {
      id: true,
      classId: true,
      status: true,
      date: true,
      endTime: true,
      class: { select: { teacherId: true } },
    },
  },
} satisfies Prisma.MakeupSelect;

export type MakeupWithTarget = Prisma.MakeupGetPayload<{ select: typeof makeupWithTargetSelect }>;

/** Loads a makeup with the target-session fields cancel/outcome need, or throws not-found. */
export async function loadMakeupWithTarget(input: {
  database: MakeupDatabase;
  makeupId: string;
}): Promise<MakeupWithTarget> {
  const makeup = await input.database.makeup.findUnique({
    where: { id: input.makeupId },
    select: makeupWithTargetSelect,
  });

  if (makeup === null) {
    throw notFound(MAKEUP_NOT_FOUND_MESSAGE);
  }
  return makeup;
}

/**
 * Whether a live makeup already links this origin enrollment to this session. The uniqueness is a raw
 * partial index (`deleted_at IS NULL`), not a Prisma `@@unique`, so this is a `findFirst` guard; the DB
 * index remains the backstop against a concurrent duplicate.
 */
export async function makeupExists(input: {
  database: MakeupDatabase;
  originEnrollmentId: string;
  targetClassSessionId: string;
}): Promise<boolean> {
  const existing = await input.database.makeup.findFirst({
    where: {
      originEnrollmentId: input.originEnrollmentId,
      targetClassSessionId: input.targetClassSessionId,
    },
    select: { id: true },
  });

  return existing !== null;
}
