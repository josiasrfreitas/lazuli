import { AsyncLocalStorage } from "node:async_hooks";
import { writeFile } from "node:fs/promises";
import { Session } from "node:inspector/promises";
import { monitorEventLoopDelay, performance } from "node:perf_hooks";

import { instrumentReceivablesReads, type ReadRequest } from "./receivables-read-probe.mjs";

type QuerySpan = { table: string; startedMs: number; durationMs: number; rows: number | null };
type PoolSpan = { waitMs: number; saturatedAtStart: boolean };
type Request = ReadRequest & {
  beforeCpu: NodeJS.CpuUsage;
  cpuMs: number;
  partCache: Map<Intl.DateTimeFormat, Map<number, Intl.DateTimeFormatPart[]>>;
  id: number;
  startedMs: number;
  durationMs: number;
  queries: QuerySpan[];
  pool: PoolSpan[];
};
type PoolLike = {
  idleCount: number;
  totalCount: number;
  options: { max: number };
  connect: (callback?: (...args: unknown[]) => void) => Promise<unknown> | void;
  query: (...args: unknown[]) => Promise<{ rows?: unknown[] }>;
};
const round = (value: number) => Math.round(value * 100) / 100;

function summary(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const percentile = (fraction: number) =>
    round(sorted[Math.ceil(sorted.length * fraction) - 1] ?? 0);
  return {
    n: values.length,
    p50: percentile(0.5),
    p99: percentile(0.99),
    sum: round(values.reduce((a, b) => a + b, 0)),
  };
}

/** Local diagnostic hooks; retain timings/counts only, never SQL or parameters. */
export function receivablesDiagnostics(
  prefix: string,
  intlMode?: "observe" | "reuse-formatters" | "observe-parts" | "reuse-parts",
  captureCpu = true,
) {
  const context = new AsyncLocalStorage<Request>();
  const session = new Session();
  session.connect();
  let requests: Request[] = [];
  let origin = 0;
  let utilization = performance.eventLoopUtilization();
  const delay = monitorEventLoopDelay({ resolution: 10 });
  let active = false;
  let concurrency = 0;
  let repetition = 0;
  let memoryStart = process.memoryUsage();
  const runs: unknown[] = [];
  const DateTimeFormat = Intl.DateTimeFormat;
  const formatToParts = DateTimeFormat.prototype.formatToParts;
  let partsCalls = 0;
  let partsMs = 0;
  let partsCacheHits = 0;
  let distinctPartsInstants = 0;
  let constructorCalls = 0;
  let constructorMs = 0;
  let cacheHits = 0;
  let configurations = new Map<string, Intl.DateTimeFormat>();
  function restoreIntl() {
    Intl.DateTimeFormat = DateTimeFormat;
    DateTimeFormat.prototype.formatToParts = formatToParts;
  }
  function observeIntl() {
    constructorCalls = 0;
    constructorMs = 0;
    cacheHits = 0;
    configurations = new Map();
    partsCalls = 0;
    partsMs = 0;
    partsCacheHits = 0;
    distinctPartsInstants = 0;
    if (!intlMode) return;
    if (intlMode === "observe-parts" || intlMode === "reuse-parts") {
      DateTimeFormat.prototype.formatToParts = function (date?: Date | number) {
        const request = context.getStore();
        if (!active || !request || date === undefined) return formatToParts.call(this, date);
        partsCalls += 1;
        const timestamp = Number(date);
        let instants = request.partCache.get(this);
        if (!instants) {
          instants = new Map();
          request.partCache.set(this, instants);
        }
        const previous = instants.get(timestamp);
        if (previous && intlMode === "reuse-parts") {
          partsCacheHits += 1;
          return previous;
        }
        const before = performance.now();
        const parts = formatToParts.call(this, date);
        partsMs += performance.now() - before;
        if (!instants.has(timestamp)) distinctPartsInstants += 1;
        instants.set(timestamp, parts);
        return parts;
      };
      return;
    }
    Intl.DateTimeFormat = new Proxy(DateTimeFormat, {
      construct(target, args) {
        constructorCalls += 1;
        const key = JSON.stringify(args);
        if (intlMode === "reuse-formatters" && configurations.has(key)) {
          cacheHits += 1;
          return configurations.get(key)!;
        }
        const before = performance.now();
        const formatter = Reflect.construct(target, args) as Intl.DateTimeFormat;
        constructorMs += performance.now() - before;
        configurations.set(key, formatter);
        return formatter;
      },
    });
  }

  function instrumentPool(pool: PoolLike) {
    const connect = pool.connect.bind(pool);
    pool.connect = (callback?: (...args: unknown[]) => void) => {
      const request = context.getStore();
      const start = performance.now();
      const saturatedAtStart = pool.idleCount === 0 && pool.totalCount >= pool.options.max;
      const record = () => {
        if (active && request)
          request.pool.push({ waitMs: round(performance.now() - start), saturatedAtStart });
      };
      if (callback)
        return connect((...args: unknown[]) => {
          record();
          callback(...args);
        });
      return (connect() as Promise<unknown>).then((client: unknown) => {
        record();
        return client;
      });
    };
    const query = pool.query.bind(pool);
    pool.query = (...args: unknown[]) => {
      const request = context.getStore();
      const start = performance.now();
      const text =
        typeof args[0] === "string" ? args[0] : ((args[0] as { text?: string })?.text ?? "");
      const table = /\bFROM\s+"?(?:public"?\.)?"?(\w+)/iu.exec(text)?.[1] ?? "other";
      return query(...args).then((result: { rows?: unknown[] }) => {
        if (active && request)
          request.queries.push({
            table,
            startedMs: round(start - origin),
            durationMs: round(performance.now() - start),
            rows: result.rows?.length ?? null,
          });
        return result;
      });
    };
  }

  async function beginRun(value: number, runRepetition = 1) {
    concurrency = value;
    repetition = runRepetition;
    memoryStart = process.memoryUsage();
    requests = [];
    delay.reset();
    delay.enable();
    if (captureCpu) {
      await session.post("Profiler.enable");
      await session.post("Profiler.setSamplingInterval", { interval: 1000 });
      await session.post("Profiler.start");
    }
    origin = performance.now();
    utilization = performance.eventLoopUtilization();
    active = true;
    observeIntl();
  }

  function call<T>(id: number, work: () => Promise<T>): Promise<T> {
    const start = performance.now();
    const request: Request = {
      id,
      startedMs: round(start - origin),
      durationMs: 0,
      queries: [],
      pool: [],
      reads: [],
      cardinality: {},
      partCache: new Map(),
      beforeCpu: process.cpuUsage(),
      cpuMs: 0,
    };
    requests.push(request);
    return context.run(request, async () => {
      try {
        return await work();
      } finally {
        request.durationMs = round(performance.now() - start);
        const cpu = process.cpuUsage(request.beforeCpu);
        request.cpuMs = (cpu.user + cpu.system) / 1000;
        request.partCache.clear();
      }
    });
  }

  async function endRun() {
    active = false;
    restoreIntl();
    const elapsedMs = performance.now() - origin;
    const memoryEnd = process.memoryUsage();
    const processLifetimeMaxRss = process.resourceUsage().maxRSS * 1024;
    const loop = performance.eventLoopUtilization(utilization);
    delay.disable();
    const profilePath = captureCpu ? `${prefix}-r${repetition}-c${concurrency}.cpuprofile` : null;
    if (profilePath) {
      const { profile } = await session.post("Profiler.stop");
      await writeFile(profilePath, JSON.stringify(profile), { flag: "wx" });
    }
    const waits = requests.flatMap((request) => request.pool);
    const queries = requests.flatMap((request) => request.queries);
    const tables = [...new Set(queries.map((query) => query.table))];
    runs.push({
      concurrency,
      repetition,
      memoryBytes: {
        start: memoryStart,
        end: memoryEnd,
        processLifetimeMaxRss,
      },
      cardinality: requests[0]?.cardinality ?? {},
      cardinalityStable: requests.every(
        (request) =>
          JSON.stringify(request.cardinality) === JSON.stringify(requests[0]?.cardinality),
      ),
      readAndProcessing: requests.map((request) => {
        // These four production delegates are awaited sequentially. SQL spans are nested
        // inside them; do not add both levels. CPU subtraction is meaningful only in c1.
        const readMs = request.reads.reduce((sum, read) => sum + read.endedMs - read.startedMs, 0);
        const readCpuMs = request.reads.reduce((sum, read) => sum + read.cpuMs, 0);
        return {
          request: request.id,
          readWallMs: round(readMs),
          outsideReadWallMs: round(request.durationMs - readMs),
          ...(concurrency === 1
            ? {
                readProcessCpuMs: round(readCpuMs),
                outsideReadProcessCpuMs: round(request.cpuMs - readCpuMs),
              }
            : {}),
          reads: request.reads.map((read) => ({
            delegate: read.delegate,
            rows: read.rows,
            wallMs: round(read.endedMs - read.startedMs),
          })),
        };
      }),
      elapsedMs: round(elapsedMs),
      profilePath,
      ...(intlMode
        ? {
            intl: {
              mode: intlMode,
              constructorCalls,
              cacheHits,
              distinctConfigurations: configurations.size,
              constructorMs: round(constructorMs),
              partsCalls,
              partsMs: round(partsMs),
              partsCacheHits,
              distinctPartsInstants,
            },
          }
        : {}),
      eventLoop: {
        utilization: round(loop.utilization * 100),
        activeMs: round(loop.active),
        idleMs: round(loop.idle),
        delayP50Ms: round(delay.percentile(50) / 1e6),
        delayP99Ms: round(delay.percentile(99) / 1e6),
        delayMaxMs: round(delay.max / 1e6),
      },
      poolAcquisitionMs: summary(waits.map((wait) => wait.waitMs)),
      saturatedAcquisitions: waits.filter((wait) => wait.saturatedAtStart).length,
      queryObservedWallMs: summary(queries.map((query) => query.durationMs)),
      tables: tables.map((table) => ({
        table,
        calls: queries.filter((query) => query.table === table).length,
        rows: queries
          .filter((query) => query.table === table)
          .reduce((sum, query) => sum + (query.rows ?? 0), 0),
        durationMs: summary(
          queries.filter((query) => query.table === table).map((query) => query.durationMs),
        ),
      })),
      requests: requests.map(
        ({ partCache: _cache, beforeCpu: _cpu, cpuMs: _cpuMs, reads: _reads, ...request }) =>
          request,
      ),
    });
  }

  return {
    instrumentPool,
    instrumentDatabase: (database: Parameters<typeof instrumentReceivablesReads>[0]) =>
      instrumentReceivablesReads(database, () => (active ? context.getStore() : undefined)),
    beginRun,
    endRun,
    call,
    runs,
    close: () => {
      restoreIntl();
      delay.disable();
      session.disconnect();
    },
  };
}
