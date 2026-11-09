import type { Prisma, TransactionClient } from "@lazuli/db";
import { createServiceLogger, logDevelopmentProcess } from "@lazuli/logging";
import type { Context, StaffUser } from "../trpc/context.js";
import { procedureOutcomeLabel } from "../trpc/procedure-labels.js";
import { ACTIVITY_ACTIONS, type ActivityAction } from "./catalog.js";

export type ActivitySubject = {
  type: "student" | "class" | "teacher" | "lead" | "contract" | "receivable" | "payer" | "school";
  id?: string | undefined;
  name: string;
};
export type ActivityDetails = {
  subject: ActivitySubject;
  description?: string | undefined;
  deduplicationKey?: string | undefined;
};
type ActorContext = {
  staffUser: StaffUser;
  now?: Date | undefined;
  requestId?: string | undefined;
};
const logger = createServiceLogger("web");

/** The caller owns the transaction; failed business operations cannot leave a success event. */
export async function recordActivity(
  database: Pick<Prisma.TransactionClient, "activityEvent">,
  options: {
    context: ActorContext;
    action: ActivityAction;
    details: ActivityDetails;
  },
): Promise<void> {
  const { context, action, details } = options;

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
  await (data.deduplicationKey
    ? database.activityEvent.upsert({
        where: { deduplicationKey: data.deduplicationKey },
        create: data,
        update: {},
      })
    : database.activityEvent.create({ data }));
}

export async function activityTransaction<T>(
  context: ActorContext & { db: Context["db"] },
  command: {
    action: ActivityAction;
    work: (database: TransactionClient) => Promise<T>;
    describe: (
      result: T,
      database: TransactionClient,
    ) => ActivityDetails | null | Promise<ActivityDetails | null>;
    options?:
      | {
          timeout?: number;
          isolationLevel?: Prisma.TransactionIsolationLevel;
        }
      | undefined;
  },
): Promise<T> {
  const { action, work, describe, options } = command;
  const started = performance.now();
  const title = procedureOutcomeLabel(action);
  logDevelopmentProcess(logger, {
    requestId: context.requestId,
    userId: context.staffUser.id,
    resource: action,
    operation: "POST",
    step: `Starting: ${action}`,
  });
  let activityRecorded = false;
  const result = await context.db.$transaction(async (database) => {
    const result = await work(database);
    const details = await describe(result, database);
    if (details) {
      await recordActivity(database, { context, action, details });
      activityRecorded = true;
    }
    return result;
  }, options);
  logDevelopmentProcess(logger, {
    requestId: context.requestId,
    userId: context.staffUser.id,
    resource: action,
    operation: "POST",
    step: title,
    durationMs: Math.round(performance.now() - started),
    facts: { activity_recorded: activityRecorded },
  });
  return result;
}
