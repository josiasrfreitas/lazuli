import type { Prisma } from "@lazuli/db";
import type { makeupCancelInputSchema, z } from "@lazuli/validators";
import type { StaffUser } from "../trpc/context.js";
import { lockTeacher } from "../teachers/availability.js";
import { ensureLegacyAppointment } from "../appointments/legacy.js";
import { cancelAppointment } from "../appointments/actions.js";

export async function cancelMakeup(input: {
  database: Prisma.TransactionClient;
  staffUser: StaffUser;
  values: z.infer<typeof makeupCancelInputSchema>;
  now?: Date;
}): Promise<{ makeupId: string; cancelledAt: Date }> {
  const now = input.now ?? new Date();
  await lockTeacher(input.database, "");
  const row = await ensureLegacyAppointment(input.database, input.values.makeupId);
  await cancelAppointment(
    { database: input.database, staffUser: input.staffUser, now },
    {
      input: {
        id: row.id,
        expectedVersion: input.values.expectedVersion,
        reason: input.values.reason,
      },
    },
  );
  return { makeupId: input.values.makeupId, cancelledAt: now };
}
