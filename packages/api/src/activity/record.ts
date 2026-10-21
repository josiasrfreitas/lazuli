import type { Prisma } from "@lazuli/db";
import type { StaffUser } from "../trpc/context.js";
import { ACTIVITY_ACTIONS, type ActivityAction } from "./catalog.js";
type ActivityContext = {
  database: Pick<Prisma.TransactionClient, "activityEvent">;
  staffUser: StaffUser;
  now: Date;
};
type ActivityDetails = {
  action: ActivityAction;
  subject: { type: "student" | "class"; id: string; name: string };
  description: string;
};
/** A failed business transaction cannot leave a success entry. */
export async function recordActivity(
  context: ActivityContext,
  details: ActivityDetails,
): Promise<void> {
  const [area, title] = ACTIVITY_ACTIONS[details.action];
  await context.database.activityEvent.create({
    data: {
      action: details.action,
      area,
      title,
      actorId: context.staffUser.id,
      actorName: context.staffUser.name,
      occurredAt: context.now,
      subjectType: details.subject.type,
      subjectId: details.subject.id,
      subjectName: details.subject.name,
      description: details.description,
    },
  });
}
