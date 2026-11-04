import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

assert.equal(
  process.argv.length,
  4,
  "Usage: node scripts/compare-staging-interaction.mjs BEFORE AFTER",
);
const [before, after] = process.argv.slice(2).map((path) => JSON.parse(readFileSync(path, "utf8")));

const comparable = (run) => ({
  baseUrl: run.baseUrl,
  benchmarkProtocol: run.benchmarkProtocol,
  browserVersion: run.browserVersion,
  method: run.method,
  profile: run.profile,
  routes: run.routes,
  samplesPerRoute: run.samplesPerRoute,
});
assert.deepEqual(comparable(after), comparable(before), "Benchmark conditions differ");
assert.equal(before.profile, "first", "Expected first navigation");
assert.equal(before.benchmarkProtocol, "in-page-paint-marks-v2", "Expected paint marks v2");
assert.deepEqual(
  before.routes.map((route) => route.path),
  ["/"],
  "Expected panel-only run",
);

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.ceil(sorted.length * fraction) - 1] * 10) / 10;
}

function panel(run) {
  const values = run.samples.map((sample) => {
    assert.equal(sample.route, "/");
    assert.ok(Number.isFinite(sample.fullReadyMs) && sample.fullReadyMs >= 0);
    return sample.fullReadyMs;
  });
  assert.equal(values.length, run.samplesPerRoute);
  assert.ok(values.length >= 20, "p95 needs at least 20 samples");
  return { n: values.length, p50: percentile(values, 0.5), p95: percentile(values, 0.95) };
}

const oldPanel = panel(before);
const newPanel = panel(after);
console.log(
  JSON.stringify({
    metric: "panel fullReadyMs",
    before: { measuredAt: before.measuredAt, ...oldPanel },
    after: { measuredAt: after.measuredAt, ...newPanel },
    deltaP95Ms: Math.round((newPanel.p95 - oldPanel.p95) * 10) / 10,
  }),
);
