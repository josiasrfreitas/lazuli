import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { Session } from "node:inspector/promises";
import { performance } from "node:perf_hooks";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    output: { type: "string" },
    help: { type: "boolean" },
    "cpu-profile": { type: "string" },
    samples: { type: "string", default: "60" },
    "max-list-queries": { type: "string" },
    "observe-intl": { type: "boolean" },
  },
});
if (values.help) {
  process.stdout.write(
    "Usage: pnpm exec dotenv -e .env -- node --import tsx scripts/diagnose-students-list.mts [--samples 60] [--output /tmp/students.json] [--observe-intl] [--cpu-profile /tmp/students.cpuprofile] [--max-list-queries 27]\nLocalhost PostgreSQL only; read-only; pool maximum four. CPU/profile observer changes timings.\n",
  );
  process.exit(0);
}
assert(["", "local"].includes(process.env.LAZULI_ENV ?? ""), "Local diagnosis only.");
const sampleCount = Number(values.samples);
assert(
  Number.isInteger(sampleCount) && sampleCount >= 3 && sampleCount <= 500,
  "samples must be 3..500",
);
const url = new URL(process.env.DATABASE_URL!);
assert(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "Localhost database required.");
const requireFromDb = createRequire(new URL("../packages/db/package.json", import.meta.url));
const { Pool } = requireFromDb("pg");
const { PrismaPg } = requireFromDb("@prisma/adapter-pg");
const { Kysely, PostgresAdapter, PostgresIntrospector, PostgresQueryCompiler } =
  requireFromDb("kysely");
const { default: kyselyExtension } = await import(requireFromDb.resolve("prisma-extension-kysely"));
const { PrismaClient } = await import("../packages/db/src/generated/prisma/client.js");
const { softDeleteExtension } = await import("../packages/db/src/soft-delete.js");
const pool = new Pool({
  connectionString: url.toString(),
  max: 4,
  options: "-c default_transaction_read_only=on -c statement_timeout=5000",
});
type Query = { shape: string; identity: string; tables: string[]; ms: number; rows: number };
type Span = { queries: Query[]; waits: number[] };
const context = new AsyncLocalStorage<Span>();
const hash = (value: string) => createHash("sha256").update(value).digest("hex").slice(0, 12);
const round = (value: number) => Math.round(value * 100) / 100;
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const median = (values: number[]) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;
const originalConnect = pool.connect.bind(pool);
pool.connect = (callback?: (...args: unknown[]) => void) => {
  const span = context.getStore();
  const start = performance.now();
  const record = () => span?.waits.push(performance.now() - start);
  if (callback)
    return originalConnect((...args: unknown[]) => {
      record();
      callback(...args);
    });
  return originalConnect().then((client: unknown) => {
    record();
    return client;
  });
};
const originalQuery = pool.query.bind(pool);
pool.query = async (...args: unknown[]) => {
  const span = context.getStore();
  const start = performance.now();
  const sql = typeof args[0] === "string" ? args[0] : (args[0] as { text: string }).text;
  const parameters =
    typeof args[0] === "string" ? args[1] : (args[0] as { values?: unknown[] }).values;
  const result = await originalQuery(...args);
  if (span)
    span.queries.push({
      shape: hash(sql),
      identity: hash(sql + JSON.stringify(parameters)),
      tables: [
        ...new Set(
          [
            ...sql.replaceAll('"', "").matchAll(/\b(?:FROM|JOIN)\s+(?:public\.)?([A-Za-z]\w*)/giu),
          ].map((match) => match[1]!),
        ),
      ],
      ms: performance.now() - start,
      rows: result.rows?.length ?? 0,
    });
  return result;
};
const raw = new PrismaClient({ adapter: new PrismaPg(pool, { disposeExternalPool: true }) });
const database = raw.$extends(softDeleteExtension as never).$extends(
  kyselyExtension({
    kysely: (driver: unknown) =>
      new Kysely({
        dialect: {
          createAdapter: () => new PostgresAdapter(),
          createDriver: () => driver,
          createIntrospector: (db: unknown) => new PostgresIntrospector(db),
          createQueryCompiler: () => new PostgresQueryCompiler(),
        },
      }),
  }),
) as unknown as typeof import("../packages/db/src/index.js").db;
const { createCaller } = await import("../packages/api/src/root.js");
const { db: singleton } = await import("../packages/db/src/index.js");
const queryApi = await import("../packages/api/src/students/list-query.js");
const { resolveCurrentSemester } = await import("../packages/api/src/students/list.js");
const { studentsWithPendingRegistration } =
  await import("../packages/api/src/students/pending-actions.js");
const { studentOverdueTotals } =
  await import("../packages/api/src/finance/internal/student-balances.js");
const { computeEnrollmentsPercentInWindow } =
  await import("../packages/db/src/attendance-percent.js");
const { studentListInputSchema } = await import("../packages/validators/src/student-list.js");
const now = new Date("2026-11-03T15:00:00Z");
const quantile = (items: number[], p: number) =>
  [...items].sort((a, b) => a - b)[Math.max(0, Math.ceil(items.length * p) - 1)] ?? 0;
const captures: unknown[] = [];
async function capture(name: string, work: () => Promise<unknown>, concurrency = 1, samples = 10) {
  const spans: Span[] = [];
  const latencies: number[] = [];
  const serialCpuMs: number[] = [];
  let index = 0;
  let result: unknown;
  const hashes = new Set<string>();
  const DateTimeFormat = Intl.DateTimeFormat;
  const originalParts = DateTimeFormat.prototype.formatToParts;
  let partsCalls = 0;
  let partsMs = 0;
  let formatterCalls = 0;
  let formatterMs = 0;
  if (values["observe-intl"]) {
    DateTimeFormat.prototype.formatToParts = function (date?: Date | number) {
      const start = performance.now();
      const parts = originalParts.call(this, date);
      partsCalls++;
      partsMs += performance.now() - start;
      return parts;
    };
    Intl.DateTimeFormat = new Proxy(DateTimeFormat, {
      construct(target, args) {
        const before = performance.now();
        const formatter = Reflect.construct(target, args) as Intl.DateTimeFormat;
        formatterCalls++;
        formatterMs += performance.now() - before;
        return formatter;
      },
    });
  }
  const memoryStart = process.memoryUsage();
  const utilizationStart = performance.eventLoopUtilization();
  const cpuStart = process.cpuUsage();
  const start = performance.now();
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (index++ < samples) {
        const span: Span = { queries: [], waits: [] };
        const before = performance.now();
        const requestCpu = concurrency === 1 ? process.cpuUsage() : null;
        await context.run(span, async () => {
          result = await work();
          hashes.add(
            createHash("sha256")
              .update(
                JSON.stringify(result, (_, item) =>
                  item instanceof Map ? [...item] : item instanceof Set ? [...item] : item,
                ),
              )
              .digest("hex"),
          );
        });
        latencies.push(performance.now() - before);
        if (requestCpu) {
          const used = process.cpuUsage(requestCpu);
          serialCpuMs.push((used.user + used.system) / 1000);
        }
        spans.push(span);
      }
    }),
  );
  const cpu = process.cpuUsage(cpuStart);
  Intl.DateTimeFormat = DateTimeFormat;
  DateTimeFormat.prototype.formatToParts = originalParts;
  const queries = spans.flatMap((span) => span.queries);
  const shapes = [...new Set(queries.map((query) => query.shape))];
  const report = {
    ...(values["observe-intl"]
      ? {
          intlPartsPerCall: partsCalls / samples,
          intlPartsMsPerCall: round(partsMs / samples),
          intlConstructorsPerCall: formatterCalls / samples,
          intlConstructorMsPerCall: round(formatterMs / samples),
        }
      : {}),
    name,
    concurrency,
    samples,
    wallMs: round(performance.now() - start),
    callsPerSecond: round(samples / ((performance.now() - start) / 1000)),
    eventLoopUtilization: round(performance.eventLoopUtilization(utilizationStart).utilization),
    memoryBefore: memoryStart,
    memoryAfter: process.memoryUsage(),
    latencyP50Ms: round(median(latencies)),
    latencyP95Ms: round(quantile(latencies, 0.95)),
    latencyP99Ms: round(quantile(latencies, 0.99)),
    latenciesMs: latencies.map(round),
    outputHashCount: hashes.size,
    outputHashes: [...hashes],
    latencyMaxMs: round(Math.max(...latencies)),
    cpuMsPerCall: round((cpu.user + cpu.system) / 1000 / samples),
    serialProcessCpuMsPerCall: concurrency === 1 ? serialCpuMs.map(round) : null,
    queriesPerCall: spans.map((span) => span.queries.length),
    rowsPerCall: spans.map((span) => sum(span.queries.map((query) => query.rows))),
    queryObservedSumMsPerCall: round(sum(queries.map((query) => query.ms)) / samples),
    poolWaitSumMsPerCall: round(sum(spans.flatMap((span) => span.waits)) / samples),
    poolWaitP50Ms: round(median(spans.flatMap((span) => span.waits))),
    repeatedExactQueriesPerCall: spans.map(
      (span) => span.queries.length - new Set(span.queries.map((query) => query.identity)).size,
    ),
    exactDuplicateGroupsFirstCall: [
      ...new Set(spans[0]?.queries.map((query) => query.identity) ?? []),
    ].flatMap((identity) => {
      const same = spans[0]!.queries.filter((query) => query.identity === identity);
      return same.length > 1
        ? [{ shape: same[0]!.shape, tables: same[0]!.tables, calls: same.length }]
        : [];
    }),
    output:
      result && typeof result === "object" && "total" in result
        ? {
            total: result.total,
            items: "rows" in result && Array.isArray(result.rows) ? result.rows.length : null,
          }
        : undefined,
    templates: shapes
      .map((shape) => ({
        shape,
        tables: queries.find((query) => query.shape === shape)!.tables,
        callsPerRequest: queries.filter((query) => query.shape === shape).length / samples,
        rowsPerRequest:
          sum(queries.filter((query) => query.shape === shape).map((query) => query.rows)) /
          samples,
        observedMsPerRequest: round(
          sum(queries.filter((query) => query.shape === shape).map((query) => query.ms)) / samples,
        ),
      }))
      .sort((a, b) => b.observedMsPerRequest - a.observedMsPerRequest),
  };
  captures.push(report);
  return report;
}
try {
  const readOnly = await database.$queryRawUnsafe<Array<{ default_transaction_read_only: string }>>(
    "SHOW default_transaction_read_only",
  );
  assert.equal(readOnly[0]?.default_transaction_read_only, "on");
  const admin = await database.user.findFirstOrThrow({
    where: { isEnabled: true, role: { in: ["ADMIN", "SYSTEM_ADMIN"] } },
    select: { id: true, role: true },
  });
  const caller = createCaller({
    db: database,
    now,
    staffUser: { ...admin, name: "Benchmark", email: "benchmark@invalid.local", isEnabled: true },
  });
  const semester = await resolveCurrentSemester(database, now);
  const datasets: unknown[] = [];
  const cases: Array<{ name: string; input: unknown }> = [];
  for (const pageSize of [10, 25, 50] as const) {
    const input = studentListInputSchema.parse({ page: 1, pageSize });
    const where = queryApi.buildStudentListWhere({ ...input, teacherIds: [], now }, {});
    const students = await queryApi.findStudentPage({
      database,
      values: { where, page: 1, pageSize, now },
    });
    const enrollments = students.flatMap((student) => student.enrollments.slice(0, 1));
    const ids = students.map((student) => student.id);
    const volume: Record<string, unknown> = {
      pageSize,
      students: students.length,
      enrollments: enrollments.length,
      classes: new Set(enrollments.map((row) => row.classId)).size,
    };
    datasets.push(volume);
    await caller.students.list(input);
    for (const concurrency of [1, 4]) {
      const report = await capture(
        `students.list.page${pageSize}`,
        () => caller.students.list(input),
        concurrency,
        sampleCount,
      );
      assert.equal(report.outputHashCount, 1, "Response changed during local read-only diagnosis");
      if (values["max-list-queries"])
        assert(
          Math.max(...report.queriesPerCall) <= Number(values["max-list-queries"]),
          "students.list exceeds query budget",
        );
    }
    await capture(`page${pageSize}.pageRelations`, () =>
      queryApi.findStudentPage({ database, values: { where, page: 1, pageSize, now } }),
    );
    await capture(`page${pageSize}.tabCounts`, () =>
      queryApi.countStudentsByTab({ database, search: undefined, searchWhere: {}, now }),
    );
    await capture(`page${pageSize}.header`, () =>
      queryApi.countHeaderFacts({ database, semesterId: semester?.id ?? null }),
    );
    await capture(`page${pageSize}.total`, () => database.student.count({ where }));
    await capture(`page${pageSize}.pendingRegistration`, () =>
      studentsWithPendingRegistration(database, { ids, now }),
    );
    await capture(`page${pageSize}.finance`, () =>
      studentOverdueTotals({ database, values: { studentIds: ids, now } }),
    );
    if (semester) {
      const attendanceDatabase = {
        classSession: {
          findMany: async (args: Parameters<typeof database.classSession.findMany>[0]) => {
            const sessions = (await database.classSession.findMany(args)) as unknown as Array<{
              classId: string;
              attendanceRows: Array<{ makeupCoverages: unknown[] }>;
            }>;
            volume.attendance = {
              sessions: sessions.length,
              attendanceRows: sum(sessions.map((row) => row.attendanceRows.length)),
              coverages: sum(
                sessions.flatMap((row) =>
                  row.attendanceRows.map((attendance) => attendance.makeupCoverages.length),
                ),
              ),
              classSessionVisitsUpperBound: sum(
                enrollments.map(
                  (enrollment) =>
                    sessions.filter((row) => row.classId === enrollment.classId).length,
                ),
              ),
            };
            return sessions;
          },
        },
      };
      await capture(`page${pageSize}.attendance`, () =>
        computeEnrollmentsPercentInWindow({ database, values: { enrollments, semester } }),
      );
      await computeEnrollmentsPercentInWindow({
        database: attendanceDatabase as never,
        values: { enrollments, semester },
      });
    }
    const financeDatabase = new Proxy(database, {
      get(target, key) {
        if (key !== "order") return Reflect.get(target, key);
        return {
          findMany: async (args: Parameters<typeof database.order.findMany>[0]) => {
            const orders = (await database.order.findMany(args)) as unknown as Array<{
              installments: Array<{
                adjustments: unknown[];
                allocations: unknown[];
                dueDate: Date;
                waivedAt: Date | null;
              }>;
            }>;
            volume.finance = {
              orders: orders.length,
              installments: sum(orders.map((order) => order.installments.length)),
              adjustments: sum(
                orders.flatMap((order) =>
                  order.installments.map((item) => item.adjustments.length),
                ),
              ),
              allocations: sum(
                orders.flatMap((order) =>
                  order.installments.map((item) => item.allocations.length),
                ),
              ),
            };
            return orders;
          },
        };
      },
    });
    await studentOverdueTotals({ database: financeDatabase, values: { studentIds: ids, now } });
    if (pageSize === 25) {
      // Public synthetic text, never derived from a person's name, phone or identifier.
      cases.push({ name: "search.synthetic", input: { ...input, search: "a" } });
      const classId = enrollments[0]?.classId;
      if (classId) cases.push({ name: "filter.class", input: { ...input, classIds: [classId] } });
      const teacher = await database.user.findFirst({
        where: { deletedAt: null, isEnabled: true, role: "TEACHER" },
        select: { id: true },
      });
      if (teacher)
        cases.push({ name: "filter.teacher", input: { ...input, teacherIds: [teacher.id] } });
      cases.push({ name: "filter.inactive", input: { ...input, status: "inactive" } });
    }
  }
  await capture("semester", () => resolveCurrentSemester(database, now));
  for (const scenario of cases) {
    const input = studentListInputSchema.parse(scenario.input);
    await caller.students.list(input);
    await capture(scenario.name, () => caller.students.list(input), 1, 10);
  }
  if (values["cpu-profile"]) {
    const inspector = new Session();
    inspector.connect();
    await inspector.post("Profiler.enable");
    await inspector.post("Profiler.start");
    const input = studentListInputSchema.parse({ page: 1, pageSize: 50 });
    await capture("profile.students.list.page50", () => caller.students.list(input), 1, 60);
    const { profile } = await inspector.post("Profiler.stop");
    await writeFile(values["cpu-profile"]!, JSON.stringify(profile), { flag: "wx" });
    inspector.disconnect();
  }
  const output = {
    schema: "lazuli.students-list-diagnosis.v1",
    measuredAt: new Date().toISOString(),
    businessNow: now.toISOString(),
    environment: "local",
    poolMax: 4,
    readOnly: true,
    runtime: { node: process.version, arch: process.arch },
    method: {
      samplesPerScenario: sampleCount,
      componentSamples: 10,
      instrumentation:
        "query hashes, ALS attribution and response SHA256 included in timings; observed modes add overhead",
      concurrency: [1, 4],
      pages: [10, 25, 50],
      cpu: "process batch CPU divided by completed calls; overlapping calls are not individually attributed",
      sqlTiming:
        "client-observed duration includes pool wait and transport; overlapping queries are not additive wall time",
      percentile: "empirical nearest rank; short local sample does not estimate production p99",
      components: "real exported functions measured separately, not additive endpoint wall times",
      observeIntl: Boolean(values["observe-intl"]),
      cpuProfileWorkload: values["cpu-profile"]
        ? "60 additional serial students.list page50 calls only"
        : null,
    },
    datasets,
    captures,
  };
  const json = JSON.stringify(output, null, 2) + "\n";
  if (values.output) await writeFile(values.output, json, { flag: "wx" });
  else process.stdout.write(json);
} finally {
  await raw.$disconnect();
  await singleton.$disconnect();
}
