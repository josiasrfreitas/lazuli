import { isAtLeastTomorrowInSaoPaulo } from "@lazuli/domain";
import type { makeupScheduleInputSchema, z } from "@lazuli/validators";

import type { StaffUser } from "../trpc/context.js";
import { loadSessionWithClass, type SessionWithClass } from "./data.js";
import {
  loadOriginEnrollment,
  makeupExists,
  type MakeupDatabase,
  type OriginEnrollment,
} from "./makeup-data.js";
import {
  MAKEUP_DUPLICATE_MESSAGE,
  MAKEUP_SAME_CLASS_MESSAGE,
  MAKEUP_TARGET_CANCELLED_MESSAGE,
  MAKEUP_TARGET_IN_PAST_MESSAGE,
  badRequest,
} from "./makeup-errors.js";

type ScheduleInput = z.infer<typeof makeupScheduleInputSchema>;

export type ScheduleMakeupResult = {
  makeupId: string;
  originEnrollmentId: string;
  targetClassSessionId: string;
  scheduledAt: Date;
};

/**
 * Schedules a makeup visitor into a future target session (S-ATT-3, TECHNICAL_SPEC §4.6). The target
 * must be SCHEDULED and at least tomorrow in `America/Sao_Paulo`; the target class must differ from the
 * origin class unless the caller records an override `reason`. No attendance row is created here — the
 * outcome is set later (S-ATT-2) and makeups never affect attendance %.
 */
export async function scheduleMakeup(input: {
  database: MakeupDatabase;
  staffUser: StaffUser;
  values: ScheduleInput;
}): Promise<ScheduleMakeupResult> {
  const origin = await loadOriginEnrollment({
    database: input.database,
    enrollmentId: input.values.originEnrollmentId,
  });
  const target = await loadSessionWithClass({
    database: input.database,
    sessionId: input.values.targetClassSessionId,
  });

  assertTargetSchedulable(target);
  assertDistinctClass({ origin, target, reason: input.values.reason });
  await assertNotDuplicate({ database: input.database, origin, target });

  const created = await input.database.makeup.create({
    data: {
      originEnrollmentId: origin.id,
      targetClassSessionId: target.id,
      scheduledById: input.staffUser.id,
      reason: input.values.reason ?? null,
    },
    select: { id: true, scheduledAt: true },
  });

  return {
    makeupId: created.id,
    originEnrollmentId: origin.id,
    targetClassSessionId: target.id,
    scheduledAt: created.scheduledAt,
  };
}

function assertTargetSchedulable(target: SessionWithClass): void {
  if (target.status === "CANCELLED") {
    throw badRequest(MAKEUP_TARGET_CANCELLED_MESSAGE);
  }
  if (!isAtLeastTomorrowInSaoPaulo({ targetDate: target.date, now: new Date() })) {
    throw badRequest(MAKEUP_TARGET_IN_PAST_MESSAGE);
  }
}

function assertDistinctClass(input: {
  origin: OriginEnrollment;
  target: SessionWithClass;
  reason: string | undefined;
}): void {
  const sameClass = input.origin.classId === input.target.classId;
  if (sameClass && input.reason === undefined) {
    throw badRequest(MAKEUP_SAME_CLASS_MESSAGE);
  }
}

async function assertNotDuplicate(input: {
  database: MakeupDatabase;
  origin: OriginEnrollment;
  target: SessionWithClass;
}): Promise<void> {
  const exists = await makeupExists({
    database: input.database,
    originEnrollmentId: input.origin.id,
    targetClassSessionId: input.target.id,
  });
  if (exists) {
    throw badRequest(MAKEUP_DUPLICATE_MESSAGE);
  }
}
