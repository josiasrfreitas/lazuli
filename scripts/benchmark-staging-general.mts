import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { performance } from "node:perf_hooks";

import { createCaller } from "../packages/api/src/root.js";
import { getDatabaseUrl } from "../packages/db/src/config.js";
import { db } from "../packages/db/src/index.js";
import { PrismaClient } from "../packages/db/src/generated/prisma/client.js";
import { softDeleteExtension } from "../packages/db/src/soft-delete.js";

const requireFromDb = createRequire(new URL("../packages/db/package.json", import.meta.url));
const { PrismaPg } = requireFromDb("@prisma/adapter-pg");
const { Kysely, PostgresAdapter, PostgresIntrospector, PostgresQueryCompiler } =
  requireFromDb("kysely");
const { default: kyselyExtension } = await import(requireFromDb.resolve("prisma-extension-kysely"));
const { Client: PgClient } = requireFromDb("pg");

const smoke = process.argv.includes("--smoke");
const profileOnly = process.argv.includes("--profile-only");
const explain = process.argv.includes("--explain");
const SAMPLES = smoke ? 3 : 100;
const MIXED_SAMPLES = smoke ? 7 : 200;
const now = new Date();

if (process.env.LAZULI_ENV !== "staging") {
  throw new Error("This benchmark runs only in staging.");
}

type QuerySample = {
  sql: string;
  values: unknown[];
  durationMs: number;
  source: "prisma" | "kysely";
  scenario: string;
};
type Scenario = { name: string; run: () => Promise<unknown> };

function quantile(sorted: readonly number[], fraction: number): number {
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)]!;
}

function summarize(values: readonly number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    n: sorted.length,
    p50: Math.round(quantile(sorted, 0.5) * 10) / 10,
    p95: Math.round(quantile(sorted, 0.95) * 10) / 10,
    p99: Math.round(quantile(sorted, 0.99) * 10) / 10,
    max: Math.round(sorted.at(-1)! * 10) / 10,
    mean: Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10,
  };
}

function queryId(sql: string): string {
  return createHash("sha256").update(sql).digest("hex").slice(0, 12);
}

function queryTables(sql: string): string[] {
  const plain = sql.replaceAll('"', "");
  return [
    ...new Set(
      [...plain.matchAll(/\b(?:FROM|JOIN|UPDATE|INTO)\s+(?:public\.)?([A-Za-z]\w*)/giu)].map(
        (match) => match[1]!,
      ),
    ),
  ];
}

function decodePrismaValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decodePrismaValue);
  if (typeof value !== "object" || value === null) return value;
  const tagged = value as { prisma__type?: string; prisma__value?: unknown };
  if (tagged.prisma__type === "date" || tagged.prisma__type === "datetime") {
    return new Date(String(tagged.prisma__value));
  }
  if (tagged.prisma__type === "time") return String(tagged.prisma__value);
  if (tagged.prisma__type === "bigint") return String(tagged.prisma__value);
  if (tagged.prisma__type === "decimal") return String(tagged.prisma__value);
  if (tagged.prisma__type === "bytes") return Buffer.from(String(tagged.prisma__value), "base64");
  return value;
}

async function explainQueries(samples: QuerySample[]) {
  const totals = new Map<string, { sample: QuerySample; durations: number[] }>();
  for (const sample of samples) {
    if (!/^\s*SELECT\b/iu.test(sample.sql) || /\bFOR\s+UPDATE\b/iu.test(sample.sql)) continue;
    const id = queryId(sample.sql);
    const current = totals.get(id);
    totals.set(id, {
      sample: current?.sample ?? sample,
      durations: [...(current?.durations ?? []), sample.durationMs],
    });
  }
  const client = new PgClient({ connectionString: getDatabaseUrl() });
  await client.connect();
  try {
    // EXPLAIN ANALYZE executes the statement. Bound unexpected plans in the
    // small staging instance so profiling cannot monopolize its memory/CPU.
    await client.query("SET statement_timeout = '500ms'");
    await client.query("SET lock_timeout = '500ms'");
    const plans = [];
    for (const { sample, durations } of totals.values()) {
      try {
        const result = await client.query({
          text: `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sample.sql}`,
          values: sample.values.map(decodePrismaValue),
        });
        const plan = result.rows[0]?.["QUERY PLAN"]?.[0];
        plans.push({
          queryId: queryId(sample.sql),
          tables: queryTables(sample.sql),
          callsInProfile: durations.length,
          clientP50Ms: summarize(durations).p50,
          planningMs: plan?.["Planning Time"] ?? null,
          executionMs: plan?.["Execution Time"] ?? null,
          sharedHitBlocks: plan?.Plan?.["Shared Hit Blocks"] ?? null,
          sharedReadBlocks: plan?.Plan?.["Shared Read Blocks"] ?? null,
          tempWrittenBlocks: plan?.Plan?.["Temp Written Blocks"] ?? null,
          rootNode: plan?.Plan?.["Node Type"] ?? null,
          rootRows: plan?.Plan?.["Actual Rows"] ?? null,
        });
      } catch (error) {
        plans.push({
          queryId: queryId(sample.sql),
          tables: queryTables(sample.sql),
          callsInProfile: durations.length,
          explainError: (error as { code?: string }).code ?? "EXPLAIN_FAILED",
        });
      }
    }
    const successful = plans.filter((plan) => typeof plan.executionMs === "number");
    return {
      examined: plans.length,
      explainFailures: plans.filter((plan) => plan.explainError).length,
      failures: plans
        .filter((plan) => plan.explainError)
        .map((plan) => ({
          queryId: plan.queryId,
          tables: plan.tables,
          code: plan.explainError,
        })),
      byExecution: [...successful]
        .sort((a, b) => (b.executionMs ?? 0) - (a.executionMs ?? 0))
        .slice(0, 15),
      byBuffers: [...successful]
        .sort(
          (a, b) =>
            (b.sharedHitBlocks ?? 0) +
            (b.sharedReadBlocks ?? 0) -
            ((a.sharedHitBlocks ?? 0) + (a.sharedReadBlocks ?? 0)),
        )
        .slice(0, 15),
    };
  } finally {
    await client.end();
  }
}

async function main() {
  const admin = await db.user.findFirst({
    where: { role: { in: ["ADMIN", "SYSTEM_ADMIN"] }, isEnabled: true },
    select: { id: true, role: true },
  });
  assert(admin, "No enabled administrator in staging.");
  const teacherClass = await db.class.findFirst({
    where: { status: "ACTIVE", teacher: { role: "TEACHER", isEnabled: true } },
    select: { teacherId: true },
  });
  assert(teacherClass, "No active teacher class in staging.");
  const activeTeacher = await db.user.findUniqueOrThrow({
    where: { id: teacherClass.teacherId },
    select: { id: true, role: true },
  });
  const makeCaller = (
    database: typeof db,
    staffUser: { id: string; role: "ADMIN" | "SYSTEM_ADMIN" | "TEACHER" },
  ) =>
    createCaller({
      db: database,
      now,
      staffUser: {
        id: staffUser.id,
        role: staffUser.role,
        name: "Benchmark",
        email: "benchmark@invalid.local",
        isEnabled: true,
      },
    });
  const scenariosFor = (database: typeof db): Scenario[] => {
    const adminCaller = makeCaller(database, admin);
    const teacherCaller = makeCaller(database, { id: activeTeacher.id, role: "TEACHER" });
    return [
      { name: "home_admin", run: () => adminCaller.dashboard.home() },
      { name: "students_page25", run: () => adminCaller.students.list({ page: 1, pageSize: 25 }) },
      { name: "classes_page20", run: () => adminCaller.classes.list({ page: 1, pageSize: 20 }) },
      { name: "receivables", run: () => adminCaller.finance.receivablesSnapshot() },
      {
        name: "appointments_month",
        run: () => adminCaller.appointments.list({ from: "2026-11-01", through: "2026-11-30" }),
      },
      { name: "home_teacher", run: () => teacherCaller.dashboard.teacherHome() },
      ...(profileOnly
        ? [
            {
              name: "students_page10",
              run: () => adminCaller.students.list({ page: 1, pageSize: 10 }),
            },
            {
              name: "students_page50",
              run: () => adminCaller.students.list({ page: 1, pageSize: 50 }),
            },
          ]
        : []),
    ];
  };
  await db.$disconnect();
  const querySamples: QuerySample[] = [];
  let activeScenario = "";
  const raw = new PrismaClient({
    adapter: new PrismaPg({ connectionString: getDatabaseUrl(), max: 4 }),
    log: [{ emit: "event", level: "query" }],
  });
  raw.$on("query", (event: { query: string; params: string; duration: number }) => {
    if (!activeScenario) return;
    querySamples.push({
      sql: event.query,
      values: JSON.parse(event.params) as unknown[],
      durationMs: event.duration,
      source: "prisma",
      scenario: activeScenario,
    });
  });
  const profiled = raw.$extends(softDeleteExtension as never).$extends(
    kyselyExtension({
      kysely: (driver: unknown) =>
        new Kysely({
          dialect: {
            createAdapter: () => new PostgresAdapter(),
            createDriver: () => driver,
            createIntrospector: (database: unknown) => new PostgresIntrospector(database),
            createQueryCompiler: () => new PostgresQueryCompiler(),
          },
          log: (event: {
            query: { sql: string; parameters: readonly unknown[] };
            queryDurationMillis: number;
          }) => {
            if (!activeScenario) return;
            querySamples.push({
              sql: event.query.sql,
              values: [...event.query.parameters],
              durationMs: event.queryDurationMillis,
              source: "kysely",
              scenario: activeScenario,
            });
          },
        }),
    }),
  ) as unknown as typeof db;
  const scenarios = scenariosFor(profiled);

  async function load(scenario: Scenario, concurrency: number, count: number) {
    let index = 0;
    const latencies: number[] = [];
    const errors: Record<string, number> = {};
    const started = performance.now();
    await Promise.all(
      Array.from({ length: concurrency }, async () => {
        while (index < count) {
          index += 1;
          const before = performance.now();
          try {
            await scenario.run();
            latencies.push(performance.now() - before);
          } catch (error) {
            const code = (error as { code?: string }).code ?? "UNKNOWN";
            errors[code] = (errors[code] ?? 0) + 1;
          }
        }
      }),
    );
    return {
      scenario: scenario.name,
      concurrency,
      ...(latencies.length ? summarize(latencies) : { n: 0 }),
      errors,
      wallMs: Math.round(performance.now() - started),
    };
  }

  const runs = [];
  if (!profileOnly) {
    for (const scenario of scenarios) {
      await scenario.run();
      await scenario.run();
      for (const concurrency of [1, 4]) {
        runs.push(await load(scenario, concurrency, SAMPLES));
      }
    }
    let mixedIndex = 0;
    const mixed = {
      name: "mixed",
      run: async () => scenarios[(mixedIndex++ * 7 + 3) % scenarios.length]!.run(),
    };
    runs.push(await load(mixed, 4, MIXED_SAMPLES));
  }

  const profileRuns = [];
  try {
    for (const scenario of scenarios) {
      activeScenario = scenario.name;
      for (let index = 0; index < 3; index += 1) {
        const beforeQueries = querySamples.length;
        const beforeCpu = process.cpuUsage();
        const before = performance.now();
        const result = await scenario.run();
        const wallMs = performance.now() - before;
        const cpu = process.cpuUsage(beforeCpu);
        const queries = querySamples.slice(beforeQueries);
        profileRuns.push({
          scenario: scenario.name,
          wallMs: Math.round(wallMs * 10) / 10,
          cpuMs: Math.round((cpu.user + cpu.system) / 100) / 10,
          queryCount: queries.length,
          queryDurationSumMs:
            Math.round(queries.reduce((sum, query) => sum + query.durationMs, 0) * 10) / 10,
          responseBytes: Buffer.byteLength(JSON.stringify(result)),
        });
      }
      activeScenario = "";
    }
  } finally {
    activeScenario = "";
  }
  const queryGroups = new Map<
    string,
    { sample: QuerySample; durations: number[]; scenarios: Set<string> }
  >();
  for (const sample of querySamples) {
    const id = queryId(sample.sql);
    const group = queryGroups.get(id) ?? {
      sample,
      durations: [],
      scenarios: new Set<string>(),
    };
    group.durations.push(sample.durationMs);
    group.scenarios.add(sample.scenario);
    queryGroups.set(id, group);
  }
  const queryHotspots = [...queryGroups.entries()]
    .map(([id, group]) => ({
      queryId: id,
      source: group.sample.source,
      tables: queryTables(group.sample.sql),
      scenarios: [...group.scenarios],
      calls: group.durations.length,
      totalMs: Math.round(group.durations.reduce((a, b) => a + b, 0) * 10) / 10,
      ...summarize(group.durations),
    }))
    .sort((a, b) => b.totalMs - a.totalMs)
    .slice(0, 15);
  // EXPLAIN ANALYZE adds a separate diagnostic load on top of the benchmark.
  // Make it opt-in so a routine run cannot unexpectedly stress the small host.
  const plans = explain ? await explainQueries(querySamples) : null;
  const tableSizes = await profiled.$queryRawUnsafe<Array<{ relname: string; rows: bigint }>>(
    "select relname, n_live_tup::bigint as rows from pg_stat_user_tables order by n_live_tup desc limit 15",
  );
  console.log(
    JSON.stringify({
      measuredAt: now.toISOString(),
      environment: "staging",
      method: "direct tRPC caller in worker container; read-only",
      poolMax: 4,
      samplesPerRun: SAMPLES,
      runs,
      queryProfileRunsPerScenario: 3,
      profileRuns,
      queryHotspots,
      plans,
      tableSizes: tableSizes.map((row) => ({ table: row.relname, rows: Number(row.rows) })),
    }),
  );
  await raw.$disconnect();
}

try {
  await main();
} finally {
  await db.$disconnect();
}
