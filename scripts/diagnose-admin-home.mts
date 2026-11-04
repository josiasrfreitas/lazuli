import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import { writeFile, readdir, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { performance } from "node:perf_hooks";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    output: { type: "string" },
    "api-source": { type: "string" },
    focused: { type: "boolean" },
    "max-home-queries": { type: "string" },
    "observe-intl": { type: "boolean" },
  },
});
assert(!["staging", "prod"].includes(process.env.LAZULI_ENV ?? ""), "Local diagnosis only.");
const apiSource = resolve(values["api-source"] ?? "packages/api/src");
const apiModule = (file: string) => pathToFileURL(join(apiSource, file)).href;
const sourceHash = createHash("sha256");
const sourceFiles = (await readdir(apiSource, { recursive: true, withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
  .map((entry) => join(entry.parentPath, entry.name))
  .sort();
for (const file of sourceFiles)
  sourceHash.update(relative(apiSource, file)).update(await readFile(file));
const apiSourceFingerprint = sourceHash.digest("hex");

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
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]!
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
};
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
const { createCaller } = (await import(
  apiModule("root.ts")
)) as typeof import("../packages/api/src/root.js");
const { db: singleton } = await import("../packages/db/src/index.js");
const { HOME_GROUPS, HOME_PREVIEW_SIZE } = (await import(
  apiModule("dashboard/home-model.ts")
)) as typeof import("../packages/api/src/dashboard/home-model.js");
const { readHomePending } = (await import(
  apiModule("dashboard/home-pending.ts")
)) as typeof import("../packages/api/src/dashboard/home-pending.js");
const { readHomeAgenda } = (await import(
  apiModule("dashboard/home-schedule.ts")
)) as typeof import("../packages/api/src/dashboard/home-schedule.js");
const { readStudentAges, readLeadConversion } = await import(
  apiModule("dashboard/home-audience.ts")
);
const { readHomeSchool, homePeriod } = (await import(
  apiModule("dashboard/home-insights.ts")
)) as typeof import("../packages/api/src/dashboard/home-insights.js");
const now = new Date("2026-11-03T15:00:00-03:00");
const captures: unknown[] = [];
async function capture(name: string, work: () => Promise<unknown>, concurrency = 1, samples = 3) {
  const spans: Span[] = [];
  const latencies: number[] = [];
  const responseHashes: string[] = [];
  let index = 0;
  let result: unknown;
  const DateTimeFormat = Intl.DateTimeFormat;
  let formatterCalls = 0;
  let formatterMs = 0;
  if (values["observe-intl"])
    Intl.DateTimeFormat = new Proxy(DateTimeFormat, {
      construct(target, args) {
        const before = performance.now();
        const formatter = Reflect.construct(target, args) as Intl.DateTimeFormat;
        formatterCalls++;
        formatterMs += performance.now() - before;
        return formatter;
      },
    });
  const cpuStart = process.cpuUsage();
  const start = performance.now();
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (index++ < samples) {
        const span: Span = { queries: [], waits: [] };
        const before = performance.now();
        await context.run(span, async () => {
          const response = await work();
          result = response;
          responseHashes.push(hash(JSON.stringify(response)));
        });
        latencies.push(performance.now() - before);
        spans.push(span);
      }
    }),
  );
  const cpu = process.cpuUsage(cpuStart);
  Intl.DateTimeFormat = DateTimeFormat;
  const queries = spans.flatMap((span) => span.queries);
  const shapes = [...new Set(queries.map((query) => query.shape))];
  const report = {
    ...(values["observe-intl"]
      ? {
          intlConstructorsPerCall: formatterCalls / samples,
          intlConstructorMsPerCall: round(formatterMs / samples),
        }
      : {}),
    name,
    responseHashes: [...new Set(responseHashes)],
    concurrency,
    samples,
    wallMs: round(performance.now() - start),
    latencyP50Ms: round(median(latencies)),
    latencyP95Ms: round(
      [...latencies].sort((a, b) => a - b)[Math.ceil(latencies.length * 0.95) - 1]!,
    ),
    latenciesMs: latencies.map(round),
    latencyMaxMs: round(Math.max(...latencies)),
    cpuMsPerCall: round((cpu.user + cpu.system) / 1000 / samples),
    queriesPerCall: spans.map((span) => span.queries.length),
    rowsPerCall: spans.map((span) => sum(span.queries.map((query) => query.rows))),
    queryObservedSumMsPerCall: round(sum(queries.map((query) => query.ms)) / samples),
    poolWaitSumMsPerCall: round(sum(spans.flatMap((span) => span.waits)) / samples),
    poolWaitP50Ms: round(median(spans.flatMap((span) => span.waits))),
    repeatedExactQueriesPerCall: spans.map(
      (span) => span.queries.length - new Set(span.queries.map((query) => query.identity)).size,
    ),
    output:
      result && typeof result === "object" && "total" in result
        ? {
            total: result.total,
            items: "items" in result && Array.isArray(result.items) ? result.items.length : null,
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
  assert.equal(new Set(responseHashes).size, 1, `${name}: response changed between samples`);
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
  let home;
  if (values.focused) {
    for (let warmup = 0; warmup < 5; warmup++) {
      await caller.dashboard.home();
      await caller.dashboard.pendingLessons();
      await readHomeAgenda(database, now);
    }
    home = await capture("dashboard.home", () => caller.dashboard.home(), 1, 20);
    await capture("dashboard.home", () => caller.dashboard.home(), 4, 20);
    await capture("dashboard.pendingLessons", () => caller.dashboard.pendingLessons(), 1, 20);
    await capture("dashboard.pendingLessons", () => caller.dashboard.pendingLessons(), 4, 20);
    await capture("agenda", () => readHomeAgenda(database, now), 1, 20);
  } else {
    await caller.dashboard.home();
    home = await capture("dashboard.home", () => caller.dashboard.home(), 1, 10);
    await capture("dashboard.home", () => caller.dashboard.home(), 4, 12);
    for (const kind of HOME_GROUPS) {
      const records = kind === "lessons" || kind === "appointments";
      await capture(`pending.${kind}.preview`, () =>
        readHomePending(database, {
          kind,
          now,
          page: 1,
          pageSize: HOME_PREVIEW_SIZE,
          period: records ? "recent" : "all",
        }),
      );
      if (records)
        await capture(`pending.${kind}.history`, () =>
          readHomePending(database, { kind, now, page: 1, pageSize: 1, period: "history" }),
        );
    }
    await capture("agenda", () => readHomeAgenda(database, now));
    await capture("studentAges", () => readStudentAges(database, now));
    await capture("school", () => readHomeSchool({ database, now }));
    await capture("leadConversion", () => readLeadConversion(database, homePeriod(now)));
    await caller.dashboard.business();
    await capture("dashboard.business", () => caller.dashboard.business());
  }
  const output = {
    schema: "lazuli.admin-home-diagnosis.v1",
    measuredAt: new Date().toISOString(),
    businessNow: now.toISOString(),
    environment: "local",
    apiSourceFingerprint,
    mode: values.focused ? "focused" : "full",
    warmupsPerEndpoint: values.focused ? 5 : undefined,
    percentileMethod: "median averages the two central values; p95 uses nearest rank",
    poolMax: 4,
    readOnly: true,
    runtime: { node: process.version, arch: process.arch },
    captures,
  };
  const json = JSON.stringify(output, null, 2) + "\n";
  if (values.output) await writeFile(values.output, json, { flag: "wx" });
  else process.stdout.write(json);
  if (values["max-home-queries"])
    assert(
      Math.max(...home.queriesPerCall) <= Number(values["max-home-queries"]),
      "dashboard.home exceeds query budget",
    );
} finally {
  await raw.$disconnect();
  await singleton.$disconnect();
}
