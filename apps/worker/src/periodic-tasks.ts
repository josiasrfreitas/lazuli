import { db } from "@lazuli/db";
import { ConcurrencyLimitStrategy, type getHatchetClient } from "@lazuli/integrations/hatchet";
import { PERIODIC_WORKFLOWS } from "@lazuli/job-contracts";
import { processDueEnrollmentActions, refreshStudentHealthPending } from "@lazuli/worker-handlers";
import { recoverAssessmentFiles } from "@lazuli/worker-handlers/assessment-files";
import { recoverStudentDocuments } from "@lazuli/worker-handlers/student-documents";
import { processCalendarReconciliation } from "@lazuli/worker-handlers/calendar";
import { runJob } from "./run-job.js";

type Hatchet = Awaited<ReturnType<typeof getHatchetClient>>;

/** Stable cron registrations are shared by replicas within the database's Hatchet namespace. */
export type PeriodicTaskDefinition = Parameters<Hatchet["task"]>[0];
export function createPeriodicTasks<Task>(hatchet: {
  task: (definition: PeriodicTaskDefinition) => Task;
}): Task[] {
  const actions: Record<keyof typeof PERIODIC_WORKFLOWS, () => Promise<void>> = {
    enrollment: async () => {
      await db.$transaction(
        (database) => processDueEnrollmentActions({ database, now: new Date() }),
        {
          timeout: 30_000,
        },
      );
    },
    recovery: async () => {
      await recoverAssessmentFiles(db);
      await recoverStudentDocuments(db);
    },
    health: async () => {
      await refreshStudentHealthPending(db);
    },
    calendar: async () => {
      await processCalendarReconciliation(db);
    },
  };
  return Object.entries(PERIODIC_WORKFLOWS).map(([key, schedule]) =>
    hatchet.task({
      name: schedule.name,
      onCrons: [schedule.cron],
      retries: 0,
      executionTimeout: schedule.timeout,
      scheduleTimeout: "1m",
      concurrency: {
        expression: '"singleton"',
        maxRuns: 1,
        limitStrategy: ConcurrencyLimitStrategy.CANCEL_NEWEST,
      },
      fn: () =>
        runJob(schedule.name, async () => {
          await actions[key as keyof typeof PERIODIC_WORKFLOWS]();
          return { status: "COMPLETED" };
        }),
    }),
  );
}
