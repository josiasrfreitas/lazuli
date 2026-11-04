import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";

const BASE_URL = "https://staging.lazuli.fisklagarto.com.br";
const CHROME_PATH =
  process.env.LAZULI_PERF_CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PLAYWRIGHT_PATH =
  process.env.LAZULI_PERF_PLAYWRIGHT_PATH ??
  "/tmp/lazuli-perf-tools/node_modules/playwright-core/index.mjs";
const publicOnly = process.argv.includes("--public-only");
const smoke = process.argv.includes("--smoke");
const SAMPLES = smoke ? 1 : 5;

function summarize(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const pick = (fraction) => sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
  return {
    n: sorted.length,
    p50: Math.round(pick(0.5)),
    p95: Math.round(pick(0.95)),
    min: Math.round(sorted[0]),
    max: Math.round(sorted.at(-1)),
  };
}

function pickMetric(metrics, name) {
  return metrics.find((metric) => metric.name === name)?.value ?? 0;
}

async function measureNavigation(browser, { route, mode, storageState }) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ...(storageState ? { storageState } : {}),
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Performance.enable");
  if (mode === "slow4g") {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 40,
      downloadThroughput: 1_600_000 / 8,
      uploadThroughput: 750_000 / 8,
      connectionType: "cellular4g",
    });
  }
  await page.addInitScript(() => {
    window.__lazuliPerf = { lcp: 0, longTasks: 0, cls: 0 };
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.__lazuliPerf.lcp = entry.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.__lazuliPerf.longTasks += entry.duration;
    }).observe({ type: "longtask", buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.__lazuliPerf.cls += entry.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  const requests = new Map();
  const bytesByType = {};
  let requestCount = 0;
  let apiRequests = 0;
  cdp.on("Network.responseReceived", ({ requestId, type, response }) => {
    requests.set(requestId, { type, url: response.url });
  });
  cdp.on("Network.loadingFinished", ({ requestId, encodedDataLength }) => {
    const request = requests.get(requestId);
    if (!request) return;
    requestCount += 1;
    bytesByType[request.type] = (bytesByType[request.type] ?? 0) + encodedDataLength;
    if (request.url.includes("/api/trpc/")) apiRequests += 1;
  });
  try {
    await page.goto(`${BASE_URL}${route}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout(500);
    assert(
      new URL(page.url()).pathname === route,
      `Expected ${route}, got ${new URL(page.url()).pathname}`,
    );
    const browserTiming = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0];
      return {
        dclMs: nav.domContentLoadedEventEnd,
        loadMs: nav.loadEventEnd,
        responseMs: nav.responseEnd,
        lcpMs: window.__lazuliPerf.lcp,
        longTaskMs: window.__lazuliPerf.longTasks,
        cls: window.__lazuliPerf.cls,
        heapBytes: performance.memory?.usedJSHeapSize ?? null,
      };
    });
    const { metrics } = await cdp.send("Performance.getMetrics");
    return {
      ...browserTiming,
      taskMs: pickMetric(metrics, "TaskDuration") * 1000,
      requestCount,
      apiRequests,
      totalEncodedBytes: Object.values(bytesByType).reduce((sum, value) => sum + value, 0),
      scriptEncodedBytes: bytesByType.Script ?? 0,
      cssEncodedBytes: bytesByType.Stylesheet ?? 0,
      bytesByType,
    };
  } finally {
    await context.close();
  }
}

const { chromium } = await import(PLAYWRIGHT_PATH);
const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
try {
  let storageState;
  if (!publicOnly) {
    const link = process.env.LAZULI_PERF_MAGIC_URL;
    const stateFile = process.env.LAZULI_PERF_STORAGE_STATE;
    assert(link || stateFile, "Set LAZULI_PERF_MAGIC_URL or LAZULI_PERF_STORAGE_STATE.");
    if (link) {
      assert(new URL(link).origin === BASE_URL, "Unexpected magic-link origin.");
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(link, { waitUntil: "networkidle", timeout: 30_000 });
      assert(new URL(page.url()).pathname !== "/login", "Fixture login did not complete.");
      storageState = await context.storageState();
      if (process.env.LAZULI_PERF_STORAGE_STATE_OUT) {
        await writeFile(process.env.LAZULI_PERF_STORAGE_STATE_OUT, JSON.stringify(storageState), {
          mode: 0o600,
        });
      }
      await context.close();
    } else {
      storageState = stateFile;
    }
  }
  const routes = publicOnly ? ["/login"] : ["/", "/alunos", "/turmas", "/financeiro", "/aulas"];
  const modes = smoke ? ["desktop"] : ["desktop", "slow4g"];
  const samples = [];
  for (const mode of modes) {
    for (const route of routes) {
      for (let index = 0; index < SAMPLES; index += 1) {
        samples.push({
          route,
          mode,
          ...(await measureNavigation(browser, { route, mode, storageState })),
        });
      }
    }
  }
  const summary = [];
  for (const mode of modes) {
    for (const route of routes) {
      const rows = samples.filter((sample) => sample.mode === mode && sample.route === route);
      summary.push({
        route,
        mode,
        samples: rows.length,
        dclMs: summarize(rows.map((row) => row.dclMs)),
        lcpMs: summarize(rows.map((row) => row.lcpMs)),
        longTaskMs: summarize(rows.map((row) => row.longTaskMs)),
        taskMs: summarize(rows.map((row) => row.taskMs)),
        transferBytes: summarize(rows.map((row) => row.totalEncodedBytes)),
        scriptBytes: summarize(rows.map((row) => row.scriptEncodedBytes)),
        apiRequests: summarize(rows.map((row) => row.apiRequests)),
        heapBytes: summarize(rows.map((row) => row.heapBytes ?? 0)),
      });
    }
  }
  console.log(
    JSON.stringify({
      measuredAt: new Date().toISOString(),
      baseUrl: BASE_URL,
      browserVersion: browser.version(),
      method: publicOnly
        ? "cold Chrome navigation of public login; no response bodies retained"
        : "cold Chrome navigation with staging staff session; no response bodies retained",
      summary,
    }),
  );
} finally {
  await browser.close();
}
