import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";

import { db, type Prisma } from "../packages/db/src/index.js";
import { classCreateInputSchema } from "../packages/validators/src/class.js";
import { createClass } from "../packages/api/src/classes/data.js";
import { requestSessionGeneration } from "../packages/api/src/session-generation/requests.js";
import { generateClassSessions } from "../packages/worker-handlers/src/sessions/generate.js";

const SAMPLES = 20;
const ROLLBACK = new Error("BENCHMARK_ROLLBACK");

if (process.env.LAZULI_ENV !== "staging") throw new Error("Run this benchmark only in staging.");

type Sample = {
  createAndRequestMs: number;
  generateMs: number;
  repeatMs: number;
  sessionsPlanned: number;
};

async function rollbackTransaction<T>(
  work: (database: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  let result: T | undefined;
  try {
    await db.$transaction(
      async (database) => {
        result = await work(database);
        throw ROLLBACK;
      },
      { timeout: 60_000 },
    );
  } catch (error) {
    if (error !== ROLLBACK) throw error;
  }
  if (result === undefined) throw new Error("Benchmark returned no result.");
  return result;
}

function elapsed(from: number, to: number): number {
  return Math.round((to - from) * 10) / 10;
}

function summarize(values: readonly number[]): {
  min: number;
  p50: number;
  p95: number;
  max: number;
} {
  const sorted = [...values].toSorted((a, b) => a - b);
  return {
    min: sorted[0]!,
    p50: sorted[Math.floor(sorted.length / 2)]!,
    p95: sorted[Math.ceil(sorted.length * 0.95) - 1]!,
    max: sorted.at(-1)!,
  };
}

try {
  const now = new Date();
  const period = await db.period.findFirst({
    where: { deletedAt: null, startDate: { lte: now }, endDate: { gte: now } },
    select: { id: true, startDate: true, endDate: true },
  });
  if (!period) throw new Error("No current staging period.");
  const closedDays = await db.schoolClosedDay.findMany({
    where: {
      deletedAt: null,
      date: { gte: period.startDate, lte: period.endDate },
    },
    select: { date: true },
  });
  const closedDates = new Set(closedDays.map(({ date }) => date.toISOString().slice(0, 10)));
  const expectedDates: string[] = [];
  for (
    let time = period.startDate.getTime();
    time <= period.endDate.getTime();
    time += 86_400_000
  ) {
    const date = new Date(time);
    const dateOnly = date.toISOString().slice(0, 10);
    if (date.getUTCDay() === 0 && !closedDates.has(dateOnly)) expectedDates.push(dateOnly);
  }
  const existing = await db.class.findFirst({
    where: {
      semesterId: period.id,
      status: "ACTIVE",
      deletedAt: null,
      sharedStageId: { not: null },
      teacher: { deletedAt: null },
    },
    select: { teacherId: true, sharedStageId: true },
  });
  if (!existing?.sharedStageId) throw new Error("No active regular staging class.");

  const values = classCreateInputSchema.parse({
    teacherId: existing.teacherId,
    sharedStageId: existing.sharedStageId,
    semesterId: period.id,
    startDate: period.startDate.toISOString().slice(0, 10),
    scheduleType: "REGULAR",
    format: "ONLINE",
    slots: [{ weekday: "SUNDAY", startTime: "06:00", endTime: "07:00" }],
  });

  async function classSample(verifyDates = false): Promise<Sample> {
    return rollbackTransaction(async (database) => {
      const start = performance.now();
      const created = await createClass({
        database,
        values,
        recordedById: existing.teacherId,
      });
      await requestSessionGeneration(database, {
        scope: { classId: created.id },
        requestedById: existing.teacherId,
        now,
      });
      const afterCreate = performance.now();
      const first = await generateClassSessions({ database, payload: { classId: created.id } });
      const afterGenerate = performance.now();
      const repeat = await generateClassSessions({ database, payload: { classId: created.id } });
      const count = await database.classSession.count({ where: { classId: created.id } });
      const afterRepeat = performance.now();
      if (
        first.sessionsPlanned === 0 ||
        first.sessionsCreated !== first.sessionsPlanned ||
        repeat.sessionsCreated !== 0 ||
        count !== first.sessionsPlanned
      ) {
        throw new Error("Generated sessions are inconsistent or repeated.");
      }
      if (verifyDates) {
        const sessions = await database.classSession.findMany({
          where: { classId: created.id },
          select: { date: true },
          orderBy: { date: "asc" },
        });
        assert.deepEqual(
          sessions.map(({ date }) => date.toISOString().slice(0, 10)),
          expectedDates,
        );
      }
      return {
        createAndRequestMs: elapsed(start, afterCreate),
        generateMs: elapsed(afterCreate, afterGenerate),
        repeatMs: elapsed(afterGenerate, afterRepeat),
        sessionsPlanned: first.sessionsPlanned,
      };
    });
  }

  async function periodSample(): Promise<{
    elapsedMs: number;
    classesMatched: number;
    sessionsPlanned: number;
    sessionsMissing: number;
  }> {
    return rollbackTransaction(async (database) => {
      const start = performance.now();
      const result = await generateClassSessions({ database, payload: { semesterId: period.id } });
      return {
        elapsedMs: elapsed(start, performance.now()),
        classesMatched: result.classesMatched,
        sessionsPlanned: result.sessionsPlanned,
        sessionsMissing: result.sessionsCreated,
      };
    });
  }

  await classSample(true);
  const classSamples = [];
  for (let sample = 0; sample < SAMPLES; sample += 1) classSamples.push(await classSample());
  await periodSample();
  const periodSamples = [];
  for (let sample = 0; sample < SAMPLES; sample += 1) periodSamples.push(await periodSample());

  const duplicates = await db.$queryRaw<[{ count: bigint }]>`
    SELECT count(*)::bigint AS count FROM (
      SELECT class_id, schedule_slot_id, date
      FROM "ClassSession"
      WHERE schedule_slot_id IS NOT NULL AND deleted_at IS NULL
      GROUP BY class_id, schedule_slot_id, date
      HAVING count(*) > 1
    ) duplicate_keys
  `;
  const classCount = await db.class.count({
    where: { semesterId: period.id, status: "ACTIVE", deletedAt: null },
  });
  console.log(
    JSON.stringify({
      environment: "staging",
      samples: SAMPLES,
      periodClassCount: classCount,
      generatedClassSessions: classSamples[0]!.sessionsPlanned,
      classCreateAndRequestMs: summarize(classSamples.map((sample) => sample.createAndRequestMs)),
      classGenerationMs: summarize(classSamples.map((sample) => sample.generateMs)),
      classRepeatMs: summarize(classSamples.map((sample) => sample.repeatMs)),
      periodClassesMatched: periodSamples[0]!.classesMatched,
      periodSessionsPlanned: periodSamples[0]!.sessionsPlanned,
      periodSessionsMissing: periodSamples[0]!.sessionsMissing,
      periodGenerationMs: summarize(periodSamples.map((sample) => sample.elapsedMs)),
      duplicateSessionKeys: Number(duplicates[0]?.count ?? 0n),
    }),
  );
} finally {
  await db.$disconnect();
}
