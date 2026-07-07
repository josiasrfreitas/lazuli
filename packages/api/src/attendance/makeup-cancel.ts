import type { makeupCancelInputSchema, z } from "@lazuli/validators";

import type { StaffUser } from "../trpc/context.js";
import { loadMakeupWithTarget, type MakeupDatabase, type MakeupWithTarget } from "./makeup-data.js";
import {
  MAKEUP_ALREADY_ATTENDED_MESSAGE,
  MAKEUP_ALREADY_CANCELLED_MESSAGE,
  badRequest,
} from "./makeup-errors.js";

type CancelInput = z.infer<typeof makeupCancelInputSchema>;

export type CancelMakeupResult = {
  makeupId: string;
  cancelledAt: Date;
};

/**
 * Cancels a scheduled makeup (S-ATT-3 support). Rejects a makeup that is already cancelled or already
 * marked attended (cancel-after-attended needs an explicit correction flow, §4.6). ADMIN-only at the
 * router; the visitor simply stops rendering on the target roster once cancelled.
 */
export async function cancelMakeup(input: {
  database: MakeupDatabase;
  staffUser: StaffUser;
  values: CancelInput;
}): Promise<CancelMakeupResult> {
  const makeup = await loadMakeupWithTarget({
    database: input.database,
    makeupId: input.values.makeupId,
  });
  assertCancellable(makeup);

  const cancelledAt = new Date();
  await input.database.makeup.update({
    where: { id: makeup.id },
    data: {
      cancelledAt,
      cancelledById: input.staffUser.id,
      cancellationReason: input.values.reason,
    },
    select: { id: true },
  });

  return { makeupId: makeup.id, cancelledAt };
}

function assertCancellable(makeup: MakeupWithTarget): void {
  if (makeup.cancelledAt !== null) {
    throw badRequest(MAKEUP_ALREADY_CANCELLED_MESSAGE);
  }
  if (makeup.attendedAt !== null) {
    throw badRequest(MAKEUP_ALREADY_ATTENDED_MESSAGE);
  }
}
