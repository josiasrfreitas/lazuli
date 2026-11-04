import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { performance } from "node:perf_hooks";
import { parseArgs } from "node:util";

import { round, summarize } from "./lib/receivables-statistics.mjs";

import type { ReceivablesSnapshot } from "../packages/domain/src/receivables-dashboard.js";

const { values } = parseArgs({
  options: {
    help: { type: "boolean" },
    smoke: { type: "boolean" },
    label: { type: "string" },
    dataset: { type: "string" },
    output: { type: "string" },
    before: { type: "string" },
    after: { type: "string" },
    samples: { type: "string" },
    repetitions: { type: "string" },
    "diagnostic-prefix": { type: "string" },
    "diagnostic-no-cpu": { type: "boolean" },
    "intl-probe": { type: "string" },
  },
});
const POOL_MAX = 4;
const WARMUP_CALLS = 2;
const PROFILE_CALLS = 5;
const CONCURRENCIES = [1, 4];
const schema = "lazuli.receivables-benchmark.v1";

function businessDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

type Query = { source: "prisma" | "kysely"; durationMs: number };
type Profile = { wallMs: number; cpuMs: number; queryCount: number; queryDurationSumMs: number };
type Run = {
  repetition?: number;
  concurrency: number;
  latencyMs: ReturnType<typeof summarize>;
  wallMs: number;
  cpuMs: number;
  cpuMsPerCall: number;
  callsPerSecond: number;
  samplesMs: number[];
};
type Capture = {
  schema: string;
  label: string;
  dataset: string;
  environment: string;
  startedAt: string;
  businessDate: string;
  runtime: { node: string; platform: string; arch: string };
  method: {
    poolMax: number;
    samples: number;
    repetitions?: number;
    order?: string;
    quantiles?: string;
    warmupCalls: number;
    profileCalls: number;
    diagnostics?: { cpuSampling: boolean; intlProbe: string | null };
  };
  snapshot: ReceivablesSnapshot;
  runs: Run[];
  repetitions?: Run[];
  variability?: unknown[];
  profile: {
    samples: Profile[];
    cpuMs: ReturnType<typeof summarize>;
    queryCount: ReturnType<typeof summarize>;
    queryDurationSumMs: ReturnType<typeof summarize>;
  };
  diagnostics?: unknown[];
};

function assertSnapshot(snapshot: ReceivablesSnapshot) {
  const cents = [
    snapshot?.expectedThisMonthCents,
    snapshot?.receivedThisMonthCents,
    snapshot?.overdueCents,
    snapshot?.ageBuckets?.days1To7Cents,
    snapshot?.ageBuckets?.days8To30Cents,
    snapshot?.ageBuckets?.days30PlusCents,
  ];
  assert(
    cents.every((amount) => Number.isSafeInteger(amount)),
    "Invalid financial snapshot.",
  );
}

async function compare(beforePath: string, afterPath: string) {
  const before = JSON.parse(await readFile(beforePath, "utf8")) as Capture;
  const after = JSON.parse(await readFile(afterPath, "utf8")) as Capture;
  assert.equal(before.schema, schema, "Unknown before schema.");
  assert.equal(after.schema, schema, "Unknown after schema.");
  assert.equal(before.dataset, after.dataset, "Dataset labels differ.");
  assert.equal(before.environment, after.environment, "Environments differ.");
  assert.equal(before.businessDate, after.businessDate, "Business dates differ.");
  assert.deepEqual(before.runtime, after.runtime, "Node versions/platforms differ.");
  assert(
    !before.diagnostics || before.method.diagnostics,
    "Legacy diagnostic capture lacks mode metadata; recapture before comparison.",
  );
  assert(
    !after.diagnostics || after.method.diagnostics,
    "Legacy diagnostic capture lacks mode metadata; recapture before comparison.",
  );
  assert.deepEqual(before.method, after.method, "Measurement settings differ.");
  assertSnapshot(before.snapshot);
  assertSnapshot(after.snapshot);
  assert.deepEqual(before.snapshot, after.snapshot, "Financial snapshot differs.");
  const change = (oldValue: number, newValue: number) => ({
    before: oldValue,
    after: newValue,
    changePercent: oldValue === 0 ? null : round(((newValue - oldValue) / oldValue) * 100),
  });
  assert.deepEqual(
    before.runs.map((run) => run.concurrency),
    CONCURRENCIES,
  );
  assert.deepEqual(
    after.runs.map((run) => run.concurrency),
    CONCURRENCIES,
  );
  return {
    schema: "lazuli.receivables-comparison.v1",
    before: before.label,
    after: after.label,
    financialSnapshotEqual: true,
    snapshot: after.snapshot,
    runs: before.runs.map((run, index) => {
      const other = after.runs[index]!;
      return {
        concurrency: run.concurrency,
        p50Ms: change(run.latencyMs.p50, other.latencyMs.p50),
        ...(run.latencyMs.p95 === undefined
          ? {}
          : {
              p95Ms: change(run.latencyMs.p95, other.latencyMs.p95),
            }),
        p99Ms: change(run.latencyMs.p99, other.latencyMs.p99),
        cpuMsPerCall: change(run.cpuMsPerCall, other.cpuMsPerCall),
        callsPerSecond: change(run.callsPerSecond, other.callsPerSecond),
      };
    }),
    profile: {
      cpuP50Ms: change(before.profile.cpuMs.p50, after.profile.cpuMs.p50),
      queriesPerCall: change(before.profile.queryCount.mean, after.profile.queryCount.mean),
      queryDurationSumP50Ms: change(
        before.profile.queryDurationSumMs.p50,
        after.profile.queryDurationSumMs.p50,
      ),
    },
  };
}

async function capture(): Promise<Capture> {
  assert(values.label && values.dataset, "Capture requires --label and --dataset.");
  const environment = process.env.LAZULI_ENV ?? "local";
  assert(["local", "staging"].includes(environment), "Only local or staging is supported.");
  assert(
    !values["diagnostic-prefix"] || environment === "local",
    "Diagnostic profiles are local-only.",
  );
  const { getDatabaseUrl } = await import("../packages/db/src/config.js");
  const connectionString = getDatabaseUrl();
  if (environment === "local") {
    assert(
      ["localhost", "127.0.0.1", "[::1]"].includes(new URL(connectionString).hostname),
      "Local benchmark requires a localhost database. Remote runs require LAZULI_ENV=staging.",
    );
  }
  const samples = Number(values.samples ?? (values.smoke ? 3 : 100));
  assert(Number.isSafeInteger(samples) && samples > 0, "--samples must be a positive integer.");
  const repetitions = Number(values.repetitions ?? (values.smoke ? 1 : 3));
  assert(Number.isSafeInteger(repetitions) && repetitions > 0, "--repetitions must be positive.");
  const requireFromDb = createRequire(new URL("../packages/db/package.json", import.meta.url));
  const { PrismaPg } = requireFromDb("@prisma/adapter-pg");
  assert(
    !values["intl-probe"] || values["diagnostic-prefix"],
    "--intl-probe requires --diagnostic-prefix.",
  );
  assert(
    !values["diagnostic-no-cpu"] || values["diagnostic-prefix"],
    "--diagnostic-no-cpu requires --diagnostic-prefix.",
  );
  assert(
    !values["intl-probe"] ||
      ["observe", "reuse-formatters", "observe-parts", "reuse-parts"].includes(
        values["intl-probe"],
      ),
    "Unknown --intl-probe mode.",
  );
  const diagnostic = values["diagnostic-prefix"]
    ? (await import("./lib/receivables-diagnostics.mjs")).receivablesDiagnostics(
        values["diagnostic-prefix"],
        values["intl-probe"] as
          | "observe"
          | "reuse-formatters"
          | "observe-parts"
          | "reuse-parts"
          | undefined,
        !values["diagnostic-no-cpu"],
      )
    : undefined;
  const { Pool } = requireFromDb("pg");
  const pool = new Pool({ connectionString, max: POOL_MAX });
  diagnostic?.instrumentPool(pool);
  const { Kysely, PostgresAdapter, PostgresIntrospector, PostgresQueryCompiler } =
    requireFromDb("kysely");
  const { default: kyselyExtension } = await import(
    requireFromDb.resolve("prisma-extension-kysely")
  );
  const { PrismaClient } = await import("../packages/db/src/generated/prisma/client.js");
  const { softDeleteExtension } = await import("../packages/db/src/soft-delete.js");
  const raw = new PrismaClient({
    adapter: new PrismaPg(pool, { disposeExternalPool: true }),
    log: [{ emit: "event", level: "query" }],
  });
  // Only collect events in the separate serial profile, outside the latency runs.
  let queries: Query[] | undefined;
  raw.$on("query", (event: { duration: number }) => {
    queries?.push({ source: "prisma", durationMs: event.duration });
  });
  const database = raw.$extends(softDeleteExtension as never).$extends(
    kyselyExtension({
      kysely: (driver: unknown) =>
        new Kysely({
          dialect: {
            createAdapter: () => new PostgresAdapter(),
            createDriver: () => driver,
            createIntrospector: (database: unknown) => new PostgresIntrospector(database),
            createQueryCompiler: () => new PostgresQueryCompiler(),
          },
          log: (event: { level: string; queryDurationMillis: number }) => {
            if (event.level === "query") {
              queries?.push({ source: "kysely", durationMs: event.queryDurationMillis });
            }
          },
        }),
    }),
  ) as unknown as typeof import("../packages/db/src/index.js").db;
  let defaultDb: typeof database | undefined;
  try {
    // Import the public caller only after validating the target. Its DB singleton
    // is disconnected too; all measured reads use our bounded, instrumented pool.
    const { createCaller } = await import("../packages/api/src/root.js");
    defaultDb = (await import("../packages/db/src/index.js")).db;
    const admin = await database.user.findFirst({
      where: { role: { in: ["ADMIN", "SYSTEM_ADMIN"] }, isEnabled: true },
      select: { id: true, role: true },
      orderBy: { id: "asc" },
    });
    assert(admin, "No enabled administrator in the dataset.");
    const caller = createCaller({
      db: diagnostic ? diagnostic.instrumentDatabase(database) : database,
      now: new Date(),
      staffUser: {
        ...admin,
        name: "Benchmark",
        email: "benchmark@invalid.local",
        isEnabled: true,
      },
    });
    const startedAt = new Date().toISOString();
    const date = businessDate();
    const call = () => caller.finance.receivablesSnapshot();
    const snapshot = await call();
    assertSnapshot(snapshot);
    const verify = (result: ReceivablesSnapshot) =>
      assert.deepEqual(result, snapshot, "Snapshot changed during capture; use a stable dataset.");
    for (let index = 0; index < WARMUP_CALLS; index += 1) verify(await call());
    const batches: Run[] = [];
    for (let repetition = 1; repetition <= repetitions; repetition += 1) {
      const order = repetition % 2 === 1 ? CONCURRENCIES : [...CONCURRENCIES].reverse();
      for (const concurrency of order) {
        await diagnostic?.beginRun(concurrency, repetition);
        let index = 0;
        const samplesMs: number[] = [];
        const beforeCpu = process.cpuUsage();
        const started = performance.now();
        await Promise.all(
          Array.from({ length: concurrency }, async () => {
            while (index < samples) {
              index += 1;
              const before = performance.now();
              const result = diagnostic ? await diagnostic.call(index, call) : await call();
              samplesMs.push(performance.now() - before);
              verify(result);
            }
          }),
        );
        const wallMs = performance.now() - started;
        const cpu = process.cpuUsage(beforeCpu);
        const cpuMs = (cpu.user + cpu.system) / 1000;
        batches.push({
          repetition,
          concurrency,
          latencyMs: summarize(samplesMs),
          wallMs: round(wallMs),
          cpuMs: round(cpuMs),
          cpuMsPerCall: round(cpuMs / samples),
          callsPerSecond: round((samples * 1000) / wallMs),
          samplesMs: samplesMs.map(round),
        });
        await diagnostic?.endRun();
      }
    }
    const runs = CONCURRENCIES.map((concurrency) => {
      const selected = batches.filter((batch) => batch.concurrency === concurrency);
      const samplesMs = selected.flatMap((batch) => batch.samplesMs);
      const wallMs = selected.reduce((sum, batch) => sum + batch.wallMs, 0);
      const cpuMs = selected.reduce((sum, batch) => sum + batch.cpuMs, 0);
      return {
        concurrency,
        latencyMs: summarize(samplesMs),
        wallMs: round(wallMs),
        cpuMs: round(cpuMs),
        cpuMsPerCall: round(cpuMs / samplesMs.length),
        callsPerSecond: round((samplesMs.length * 1000) / wallMs),
        samplesMs,
      };
    });
    const profile: Profile[] = [];
    for (let index = 0; index < PROFILE_CALLS; index += 1) {
      queries = [];
      const beforeCpu = process.cpuUsage();
      const before = performance.now();
      const result = await call();
      const wallMs = performance.now() - before;
      const cpu = process.cpuUsage(beforeCpu);
      profile.push({
        wallMs: round(wallMs),
        cpuMs: round((cpu.user + cpu.system) / 1000),
        queryCount: queries.length,
        queryDurationSumMs: round(queries.reduce((sum, query) => sum + query.durationMs, 0)),
      });
      queries = undefined;
      verify(result);
    }
    assert.equal(businessDate(), date, "Capture crossed the Sao Paulo date boundary; rerun.");
    return {
      schema,
      label: values.label,
      dataset: values.dataset,
      environment,
      startedAt,
      businessDate: date,
      runtime: { node: process.version, platform: process.platform, arch: process.arch },
      method: {
        poolMax: POOL_MAX,
        samples,
        repetitions,
        order: "alternate c1/c4 then c4/c1 per repetition; closed loop; no think time",
        quantiles: "empirical nearest rank; correlated closed-loop calls; no population CI",
        warmupCalls: WARMUP_CALLS,
        profileCalls: PROFILE_CALLS,
        ...(diagnostic
          ? {
              diagnostics: {
                cpuSampling: !values["diagnostic-no-cpu"],
                intlProbe: values["intl-probe"] ?? null,
              },
            }
          : {}),
      },
      snapshot,
      runs,
      repetitions: batches,
      variability: CONCURRENCIES.map((concurrency) => {
        const selected = batches.filter((batch) => batch.concurrency === concurrency);
        return {
          concurrency,
          p50Ms: summarize(selected.map((batch) => batch.latencyMs.p50)),
          p95Ms: summarize(selected.map((batch) => batch.latencyMs.p95)),
          p99Ms: summarize(selected.map((batch) => batch.latencyMs.p99)),
          cpuMsPerCall: summarize(selected.map((batch) => batch.cpuMsPerCall)),
        };
      }),
      profile: {
        samples: profile,
        cpuMs: summarize(profile.map((sample) => sample.cpuMs)),
        queryCount: summarize(profile.map((sample) => sample.queryCount)),
        queryDurationSumMs: summarize(profile.map((sample) => sample.queryDurationSumMs)),
      },
      ...(diagnostic ? { diagnostics: diagnostic.runs } : {}),
    };
  } finally {
    await raw.$disconnect();
    await defaultDb?.$disconnect();
    diagnostic?.close();
  }
}

if (values.help) {
  console.log(`Receivables-only benchmark; no HTTP, writes, or EXPLAIN.
Capture: pnpm exec dotenv -e .env -- node --import tsx scripts/benchmark-receivables.mts \\
  --label before --dataset frozen-local-copy --output /tmp/receivables-before.json
Compare: node --import tsx scripts/benchmark-receivables.mts \\
  --before /tmp/receivables-before.json --after /tmp/receivables-after.json
Options: --smoke (3 calls, one repetition), --samples N (default 100) per repetition,
--repetitions N (default 3), --output PATH. Alternates c1/c4 order between repetitions.
For a longer tail capture: --samples 400 --repetitions 3 (1200 observations per concurrency).
Diagnostic: --diagnostic-prefix /tmp/receivables-profile saves separate c1/c4 CPU profiles
and adds event-loop, pool acquisition and observed query timing to the capture JSON.
Use --diagnostic-no-cpu to retain those hooks without the sampling profiler.
With diagnostics, --intl-probe observe counts/times Intl constructors; reuse-formatters
tests a temporary constructor cache in this process only. observe-parts counts/times
formatToParts on existing formatters; reuse-parts reuses parts for the identical formatter
and timestamp within each request. Probes change measurements, never product code.
Diagnostics additionally record Prisma read/hydration spans, count-only cardinality and
memory endpoints. Run short diagnostics separately from the uninstrumented baseline.
Run both versions on the same unchanged dataset, machine and Sao Paulo business date.
Capture permits a localhost DB or LAZULI_ENV=staging; production is rejected.`);
} else {
  // Fail before loading the API or connecting to the DB. The final wx write
  // still protects against another process creating the file during capture.
  if (values.output && existsSync(values.output)) {
    throw Object.assign(new Error("Output file already exists."), { code: "EEXIST" });
  }
  assert(Boolean(values.before) === Boolean(values.after), "Specify both --before and --after.");
  const result =
    values.before && values.after ? await compare(values.before, values.after) : await capture();
  const json = `${JSON.stringify(result, null, 2)}\n`;
  if (values.output) await writeFile(values.output, json, { flag: "wx" });
  else console.log(json);
}
