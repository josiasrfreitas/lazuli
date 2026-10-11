import type { Prisma } from "@lazuli/db";
import type { makeupOutcomeInputSchema, z } from "@lazuli/validators";
import type { StaffUser } from "../trpc/context.js";
import { lockTeacher } from "../teachers/availability.js";
import { ensureLegacyAppointment } from "../appointments/legacy.js";
import { recordAppointment } from "../appointments/record.js";

export async function markMakeupOutcome(input: {
  database: Prisma.TransactionClient;
  staffUser: StaffUser;
  values: z.infer<typeof makeupOutcomeInputSchema>;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  await lockTeacher(input.database, "");
  const row = await ensureLegacyAppointment(input.database, input.values.makeupId);
  await recordAppointment(
    { database: input.database, staffUser: input.staffUser, now },
    { ...input.values, id: row.id },
  );
  return {
    makeupId: row.legacyMakeupId!,
    attended: input.values.attended,
    attendedAt: input.values.attended ? now : null,
  };
}
