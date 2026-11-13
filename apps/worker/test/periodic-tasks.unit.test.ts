import assert from "node:assert/strict";
import { test } from "node:test";
import { createPeriodicTasks } from "../src/periodic-tasks.js";
import { ConcurrencyLimitStrategy } from "@lazuli/integrations/hatchet";

test("registers recurring business work with stable schedules and replica-wide exclusion", () => {
  const definitions: {
    name: string;
    onCrons?: string[];
    concurrency?: unknown;
    retries?: number;
  }[] = [];
  const hatchet = {
    task: (definition: (typeof definitions)[number]) => {
      definitions.push(definition);
      return definition;
    },
  } as unknown as Parameters<typeof createPeriodicTasks>[0];
  const workflows = createPeriodicTasks(hatchet);
  assert.equal(workflows.length, 4);
  assert.deepEqual(
    definitions.map(({ name, onCrons }) => ({ name, onCrons })),
    [
      { name: "enrollment-actions-process", onCrons: ["0 * * * * *"] },
      { name: "files-recover", onCrons: ["*/15 * * * * *"] },
      { name: "student-health-refresh", onCrons: ["0 * * * * *"] },
      { name: "calendar-reconcile", onCrons: ["*/5 * * * * *"] },
    ],
  );
  for (const definition of definitions) {
    assert.deepEqual(definition.concurrency, {
      expression: '"singleton"',
      maxRuns: 1,
      limitStrategy: ConcurrencyLimitStrategy.CANCEL_NEWEST,
    });
    assert.equal(definition.retries, 0);
  }
});
