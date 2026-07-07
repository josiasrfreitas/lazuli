import type { makeupOutcomeInputSchema, z } from "@lazuli/validators";

import type { StaffUser } from "../trpc/context.js";
import { assertResourceScope } from "../trpc/rbac.js";
import { loadMakeupWithTarget, type MakeupDatabase, type MakeupWithTarget } from "./makeup-data.js";
import {
  MAKEUP_ALREADY_CANCELLED_MESSAGE,
  MAKEUP_TARGET_CANCELLED_MESSAGE,
  badRequest,
} from "./makeup-errors.js";

type OutcomeInput = z.infer<typeof makeupOutcomeInputSchema>;

export type MakeupOutcomeResult = {
  makeupId: string;
  attended: boolean;
  attendedAt: Date | null;
};

/**
 * Records whether a makeup visitor showed up on the target session (S-ATT-2). `attended: true` stamps
 * `attendedAt`/`attendedById` (derives ATTENDED); `false` clears them so the outcome derives NO_SHOW
 * after the session end — making re-marking idempotent and reversible. Scoped to the target session's
 * owning teacher (ADMIN has full access). Never writes an `Attendance` row: makeups do not affect the %.
 */
export async function markMakeupOutcome(input: {
  database: MakeupDatabase;
  staffUser: StaffUser;
  values: OutcomeInput;
}): Promise<MakeupOutcomeResult> {
  const makeup = await loadMakeupWithTarget({
    database: input.database,
    makeupId: input.values.makeupId,
  });
  assertResourceScope(input.staffUser, { teacherId: makeup.targetClassSession.class.teacherId });
  assertMarkable(makeup);

  const attendedAt = input.values.attended ? new Date() : null;
  const attendedById = input.values.attended ? input.staffUser.id : null;
  await input.database.makeup.update({
    where: { id: makeup.id },
    data: { attendedAt, attendedById },
    select: { id: true },
  });

  return { makeupId: makeup.id, attended: input.values.attended, attendedAt };
}

function assertMarkable(makeup: MakeupWithTarget): void {
  if (makeup.cancelledAt !== null) {
    throw badRequest(MAKEUP_ALREADY_CANCELLED_MESSAGE);
  }
  if (makeup.targetClassSession.status === "CANCELLED") {
    throw badRequest(MAKEUP_TARGET_CANCELLED_MESSAGE);
  }
}
