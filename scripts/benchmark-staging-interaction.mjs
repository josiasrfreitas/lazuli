import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";

const BASE_URL = "https://staging.lazuli.fisklagarto.com.br";
const CHROME_PATH =
  process.env.LAZULI_PERF_CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const STORAGE_STATE =
  process.env.LAZULI_PERF_STORAGE_STATE ??
  join(homedir(), ".cache", "lazuli", "staging-benchmark-session.json");
assert(
  existsSync(STORAGE_STATE),
  `Staging login is missing: ${STORAGE_STATE}. Set LAZULI_PERF_STORAGE_STATE to an authenticated storage-state file.`,
);
const profileArg = process.argv.indexOf("--profile");
const profile = profileArg < 0 ? "first" : process.argv[profileArg + 1];
assert(["first", "repeat"].includes(profile), "--profile must be first or repeat");
const smoke = process.argv.includes("--smoke");
if (process.platform === "darwin" && !smoke && process.env.LAZULI_PERF_ALLOW_COLIMA !== "1") {
  const colima = spawnSync("colima", ["list"], { encoding: "utf8" });
  assert(
    colima.status !== 0 ||
      !colima.stdout
        .split("\n")
        .slice(1)
        .some((line) => /\bRunning\b/u.test(line)),
    "Colima is running. Stop it before a timed benchmark, or set LAZULI_PERF_ALLOW_COLIMA=1 to override.",
  );
}
const samplesArg = process.argv.indexOf("--samples");
const samplesPerRoute = smoke ? 1 : samplesArg < 0 ? 20 : Number(process.argv[samplesArg + 1]);
assert(Number.isInteger(samplesPerRoute) && samplesPerRoute > 0 && samplesPerRoute <= 40);
const routeArg = process.argv.indexOf("--route");
const allRoutes = process.argv.includes("--all") || (smoke && routeArg < 0);
const selectedPath = routeArg < 0 ? "/" : process.argv[routeArg + 1];
assert(!(allRoutes && routeArg >= 0), "Use either --all or --route");

const routes = [
  {
    path: "/",
    start: "/alunos",
    ready: 'section[aria-label="Indicadores da escola"]:not([aria-busy="true"])',
    chart: "svg.recharts-surface",
    pending: 'section[aria-labelledby="home-pending-title"]',
  },
  {
    path: "/alunos",
    start: "/turmas",
    ready:
      'table[aria-label="Lista de alunos"][aria-busy="false"]:not(:has([aria-label="Carregando score"]))',
  },
  { path: "/turmas", start: "/alunos", ready: 'table[aria-label="Turmas"] tbody tr[tabindex="0"]' },
  {
    path: "/recebiveis",
    start: "/alunos",
    ready: 'table[aria-label="Lista de recebíveis"][aria-busy="false"]',
  },
  {
    path: "/financeiro",
    start: "/alunos",
    ready: 'section[aria-labelledby="contract-closings-title"] svg.recharts-surface',
    chart: "svg.recharts-surface",
  },
  { path: "/aulas", start: "/alunos", ready: '.lz-week-calendar[aria-busy="false"]' },
];
const measuredRoutes = allRoutes ? routes : routes.filter((route) => route.path === selectedPath);
assert(measuredRoutes.length > 0, `Unknown route: ${selectedPath}`);

function summarize(values) {
  const ordered = [...values].sort((a, b) => a - b);
  const pick = (fraction) => ordered[Math.ceil(ordered.length * fraction) - 1];
  return {
    n: ordered.length,
    p50: Math.round(pick(0.5) * 10) / 10,
    ...(ordered.length >= 20 ? { p95: Math.round(pick(0.95) * 10) / 10 } : {}),
    max: Math.round(ordered.at(-1) * 10) / 10,
  };
}

async function ready(page, route) {
  await page.locator(route.ready).first().waitFor({ state: "visible", timeout: 30000 });
  assert.equal(new URL(page.url()).pathname, route.path, `Unexpected route for ${route.path}`);
  assert.equal(
    await page.locator('main [role="alert"]').count(),
    0,
    `Error shown on ${route.path}`,
  );
}

async function openSource(browser, route) {
  const context = await browser.newContext({
    storageState: STORAGE_STATE,
    viewport: { width: 1440, height: 900 },
    serviceWorkers: "block",
  });
  try {
    const page = await context.newPage();
    await page.goto(`${BASE_URL}${route.start}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await ready(
      page,
      routes.find((entry) => entry.path === route.start),
    );
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    return { context, page };
  } catch (error) {
    await context.close();
    throw error;
  }
}

async function navigate(page, route) {
  await page
    .locator(`nav[aria-label="Navegação principal"] a[href="${route.path}"]:visible`)
    .first()
    .evaluate((link) => link.click());
  await ready(page, route);
  await page.waitForLoadState("networkidle", { timeout: 15000 });
}

async function measure(page, route) {
  const requestIds = [];
  const pendingHeaders = [];
  const captureRequestId = (response) => {
    const url = new URL(response.url());
    const trpc = url.pathname.startsWith("/api/trpc/");
    if (!trpc && (url.pathname !== route.path || !url.searchParams.has("_rsc"))) return;
    const kind = trpc ? url.pathname : "rsc";
    pendingHeaders.push(
      response.headerValue("x-request-id").then((requestId) => {
        if (requestId) requestIds.push({ kind, requestId });
      }),
    );
  };
  page.on("response", captureRequestId);
  try {
    await page.evaluate(
      (target) => {
        window.__lazuliLongTasks = [];
        window.__lazuliLongTaskObserver?.disconnect();
        window.__lazuliLongTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            window.__lazuliLongTasks.push({ startTime: entry.startTime, duration: entry.duration });
          }
        });
        window.__lazuliLongTaskObserver.observe({ type: "longtask" });
        window.__lazuliPaintMarks = {};
        const scheduled = new Set();
        const visible = (selector) => {
          if (!selector) return false;
          const element = document.querySelector(selector);
          return (
            element !== null &&
            element.getClientRects().length > 0 &&
            globalThis.getComputedStyle(element).visibility !== "hidden"
          );
        };
        const pendingReady = () => {
          if (!visible(target.pending)) return false;
          const section = document.querySelector(target.pending);
          const texts = document.createTreeWalker(section, NodeFilter.SHOW_TEXT);
          while (texts.nextNode()) {
            const node = texts.currentNode;
            if (
              node.textContent?.includes("Carregando") &&
              !node.parentElement?.closest('[aria-hidden="true"], [inert]')
            ) {
              return false;
            }
          }
          return true;
        };
        const markAfterPaint = (key) => {
          if (scheduled.has(key)) return;
          scheduled.add(key);
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              window.__lazuliPaintMarks[key] = performance.now();
            }),
          );
        };
        window.__lazuliReadyObserver?.disconnect();
        window.__lazuliReadyObserver = new MutationObserver(() => {
          if (globalThis.location.pathname !== target.path) return;
          if (visible(target.ready)) markAfterPaint("ready");
          if (visible(target.chart)) markAfterPaint("chart");
          if (target.pending && pendingReady()) markAfterPaint("pending");
          if (
            scheduled.size ===
            1 + Number(Boolean(target.chart)) + Number(Boolean(target.pending))
          ) {
            window.__lazuliReadyObserver.disconnect();
          }
        });
        window.__lazuliReadyObserver.observe(document.documentElement, {
          attributes: true,
          childList: true,
          subtree: true,
        });
      },
      { path: route.path, ready: route.ready, chart: route.chart, pending: route.pending },
    );
    await page
      .locator(`nav[aria-label="Navegação principal"] a[href="${route.path}"]:visible`)
      .first()
      .evaluate((link) => {
        window.__lazuliClickStart = performance.now();
        link.click();
      });
    await ready(page, route);
    await page.waitForFunction(
      ({ chart, pending }) => {
        const marks = window.__lazuliPaintMarks;
        return (
          marks?.ready !== undefined &&
          (!chart || marks.chart !== undefined) &&
          (!pending || marks.pending !== undefined)
        );
      },
      { chart: Boolean(route.chart), pending: Boolean(route.pending) },
      { timeout: 30000 },
    );
    const marks = await page.evaluate(() => {
      const start = window.__lazuliClickStart;
      return Object.fromEntries(
        Object.entries(window.__lazuliPaintMarks).map(([key, value]) => [key, value - start]),
      );
    });
    const durationMs = marks.ready;
    const chartMountedMs = marks.chart;
    const pendingReadyMs = marks.pending;
    assert(Number.isFinite(durationMs) && durationMs >= 0, "Click timestamp was lost");
    const diagnostics = await page.evaluate(() => {
      const start = window.__lazuliClickStart;
      const resources = performance
        .getEntriesByType("resource")
        .filter((entry) => entry.startTime >= start);
      const requests = resources
        .filter(
          (entry) =>
            entry.name.includes("/api/trpc/") || new URL(entry.name).searchParams.has("_rsc"),
        )
        .map((entry) => ({
          kind: entry.name.includes("/api/trpc/") ? new URL(entry.name).pathname : "rsc",
          startMs: Math.round((entry.startTime - start) * 10) / 10,
          responseStartMs: Math.round((entry.responseStart - start) * 10) / 10,
          endMs: Math.round((entry.responseEnd - start) * 10) / 10,
          durationMs: Math.round(entry.duration * 10) / 10,
          transferBytes: entry.transferSize,
        }));
      const javascript = resources.filter((entry) => new URL(entry.name).pathname.endsWith(".js"));
      const tasks = window.__lazuliLongTasks.filter((entry) => entry.startTime >= start);
      return {
        network: requests.sort((a, b) => a.endMs - b.endMs),
        javascript: {
          count: javascript.length,
          transferBytes: javascript.reduce((sum, entry) => sum + entry.transferSize, 0),
          lastResponseMs:
            Math.round(Math.max(0, ...javascript.map((entry) => entry.responseEnd - start)) * 10) /
            10,
        },
        longTasks: {
          count: tasks.length,
          totalMs: Math.round(tasks.reduce((sum, entry) => sum + entry.duration, 0) * 10) / 10,
          maxMs: Math.round(Math.max(0, ...tasks.map((entry) => entry.duration)) * 10) / 10,
        },
      };
    });
    await Promise.allSettled(pendingHeaders);
    return {
      durationMs,
      ...(chartMountedMs === undefined ? {} : { chartMountedMs }),
      ...(pendingReadyMs === undefined ? {} : { pendingReadyMs }),
      ...(pendingReadyMs === undefined
        ? {}
        : { fullReadyMs: Math.max(durationMs, chartMountedMs ?? 0, pendingReadyMs) }),
      ...diagnostics,
      requestIds,
    };
  } finally {
    page.off("response", captureRequestId);
    await page.evaluate(() => {
      window.__lazuliLongTaskObserver?.disconnect();
      window.__lazuliReadyObserver?.disconnect();
    });
  }
}

const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
try {
  const samples = [];
  for (const route of measuredRoutes) {
    if (profile === "repeat") {
      const { context, page } = await openSource(browser, route);
      try {
        await navigate(page, route);
        await navigate(
          page,
          routes.find((entry) => entry.path === route.start),
        );
        for (let index = 0; index < samplesPerRoute; index += 1) {
          samples.push({ route: route.path, ...(await measure(page, route)) });
          if (index + 1 < samplesPerRoute) {
            await navigate(
              page,
              routes.find((entry) => entry.path === route.start),
            );
          }
        }
      } finally {
        await context.close();
      }
    } else {
      for (let index = 0; index < samplesPerRoute; index += 1) {
        const { context, page } = await openSource(browser, route);
        try {
          samples.push({ route: route.path, ...(await measure(page, route)) });
        } finally {
          await context.close();
        }
      }
    }
  }
  const summary = measuredRoutes.map((route) => ({
    route: route.path,
    ...summarize(
      samples.filter((sample) => sample.route === route.path).map((sample) => sample.durationMs),
    ),
    ...(route.chart
      ? {
          chartMounted: summarize(
            samples
              .filter((sample) => sample.route === route.path)
              .map((sample) => sample.chartMountedMs),
          ),
        }
      : {}),
    ...(route.pending
      ? {
          pendingReady: summarize(
            samples
              .filter((sample) => sample.route === route.path)
              .map((sample) => sample.pendingReadyMs),
          ),
          fullReady: summarize(
            samples
              .filter((sample) => sample.route === route.path)
              .map((sample) => sample.fullReadyMs),
          ),
        }
      : {}),
  }));
  const result = {
    measuredAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    browserVersion: browser.version(),
    benchmarkProtocol: "in-page-paint-marks-v2",
    profile,
    method: `${profile === "repeat" ? "one authenticated context per route, one unmeasured round trip, then repeated source-to-target navigation" : "fresh authenticated context per sample, source fully loaded before first navigation"}; sidebar DOM click to in-page paint marks after two animation frames; desktop 1440x900; network idle before each click; sequential`,
    samplesPerRoute,
    routes: measuredRoutes.map(({ path, start, ready, chart, pending }) => ({
      path,
      start,
      ready,
      ...(chart ? { chart } : {}),
      ...(pending ? { pending } : {}),
    })),
    summary,
    samples,
  };
  const outputPath =
    process.env.LAZULI_PERF_OUTPUT ??
    join(tmpdir(), `lazuli-staging-interaction-${result.measuredAt.replaceAll(":", "-")}.json`);
  writeFileSync(outputPath, JSON.stringify(result, null, 2), { mode: 0o600 });
  const smokeWaterfall = smoke
    ? samples.map((sample) => {
        const api = sample.network.filter((entry) => entry.kind.startsWith("/api/trpc/"));
        return {
          route: sample.route,
          readyMs: Math.round(sample.fullReadyMs ?? sample.durationMs),
          jsLastResponseMs: Math.round(sample.javascript.lastResponseMs),
          ...(api.length > 0
            ? {
                firstApiStartMs: Math.round(Math.min(...api.map((entry) => entry.startMs))),
                lastApiEndMs: Math.round(Math.max(...api.map((entry) => entry.endMs))),
              }
            : {}),
        };
      })
    : undefined;
  console.log(
    JSON.stringify({ outputPath, profile, summary, ...(smoke ? { smokeWaterfall } : {}) }),
  );
} finally {
  await browser.close();
}
