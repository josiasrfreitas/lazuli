import { db } from "@lazuli/db";

/** Far-future `@db.Date` used as a makeup target so the advance-date + SCHEDULED derivations hold. */
export const FAR_FUTURE_DATE = new Date("3000-01-01T00:00:00.000Z");

const TEST_CANCELLATION_REASON = "test-cancel";

/**
 * Inserts a `Makeup` row directly, bypassing the `scheduleMakeup` advance-date/same-class guards, so
 * cancel/outcome/visitor tests can target past or cancelled sessions. Cleanup is by origin-student
 * prefix (handled by the shared namespace `clean()`).
 */
export async function insertMakeup(input: {
  originEnrollmentId: string;
  targetClassSessionId: string;
  scheduledById?: string;
  attendedAt?: Date;
  attendedById?: string;
  cancelledAt?: Date;
}): Promise<string> {
  const makeup = await db.makeup.create({
    data: {
      originEnrollmentId: input.originEnrollmentId,
      targetClassSessionId: input.targetClassSessionId,
      scheduledById: input.scheduledById ?? null,
      ...(input.attendedAt === undefined
        ? {}
        : { attendedAt: input.attendedAt, attendedById: input.attendedById ?? null }),
      ...(input.cancelledAt === undefined
        ? {}
        : { cancelledAt: input.cancelledAt, cancellationReason: TEST_CANCELLATION_REASON }),
    },
    select: { id: true },
  });

  return makeup.id;
}

/** Counts committed attendance rows for an (enrollment, session) pair — asserts makeups write none. */
export async function attendanceRowCount(input: {
  enrollmentId: string;
  classSessionId: string;
}): Promise<number> {
  return db.attendance.count({
    where: { enrollmentId: input.enrollmentId, classSessionId: input.classSessionId },
  });
}
