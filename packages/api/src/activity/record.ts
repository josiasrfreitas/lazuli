import type { Prisma } from "@lazuli/db";
import type { Context, StaffUser } from "../trpc/context.js";
import { ACTIVITY_ACTIONS, type ActivityAction } from "./catalog.js";

export type ActivitySubject = {
  type: "student" | "class" | "teacher" | "lead" | "contract" | "receivable" | "payer" | "school";
  id?: string;
  name: string;
};
export type ActivityDetails = {
  subject: ActivitySubject;
  description?: string;
  deduplicationKey?: string;
};
type ActorContext = { staffUser: StaffUser; now?: Date };

/** The caller owns the transaction; failed business operations cannot leave a success event. */
export async function recordActivity(
  database: Pick<Prisma.TransactionClient, "activityEvent">,
  context: ActorContext,
  action: ActivityAction,
  details: ActivityDetails,
): Promise<void> {
  const [area, title] = ACTIVITY_ACTIONS[action];
  const data = {
    action,
    area,
    title,
    actorId: context.staffUser.id,
    actorName: context.staffUser.name,
    occurredAt: context.now ?? new Date(),
    subjectType: details.subject.type,
    subjectId: details.subject.id ?? null,
    subjectName: details.subject.name,
    description: details.description ?? null,
    deduplicationKey: details.deduplicationKey ?? null,
  };
  if (data.deduplicationKey) {
    await database.activityEvent.upsert({
      where: { deduplicationKey: data.deduplicationKey },
      create: data,
      update: {},
    });
  } else await database.activityEvent.create({ data });
}

export async function activityTransaction<T>(
  context: ActorContext & { db: Context["db"] },
  action: ActivityAction,
  work: (database: Prisma.TransactionClient) => Promise<T>,
  describe: (
    result: T,
    database: Prisma.TransactionClient,
  ) => ActivityDetails | null | Promise<ActivityDetails | null>,
  options?: { timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel },
): Promise<T> {
  return context.db.$transaction(async (database) => {
    const result = await work(database);
    const details = await describe(result, database);
    if (details) await recordActivity(database, context, action, details);
    return result;
  }, options);
}
