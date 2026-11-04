import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { basename, relative } from "node:path";
import { fileURLToPath } from "node:url";

const paths = process.argv.slice(2);
assert(
  paths.length > 0,
  "Usage: node scripts/analyze-receivables-cpu.mjs /tmp/profile.cpuprofile [...]",
);
const round = (value) => Math.round(value * 100) / 100;

function source(url) {
  if (!url.startsWith("file:")) return url.startsWith("node:") ? url : basename(url);
  const path = relative(process.cwd(), fileURLToPath(url));
  return path.startsWith("../") ? `external/${basename(path)}` : path;
}

function summarize(profile, path) {
  const nodes = new Map(profile.nodes.map((node) => [node.id, node]));
  const parents = new Map();
  for (const node of profile.nodes) {
    for (const child of node.children ?? []) parents.set(child, node.id);
  }
  const rows = new Map();
  const categories = new Map();
  let sampledUs = 0;
  for (let index = 0; index < profile.samples.length; index += 1) {
    const durationUs = profile.timeDeltas[index];
    sampledUs += durationUs;
    let id = profile.samples[index];
    const stack = [];
    while (id !== undefined) {
      const frame = nodes.get(id).callFrame;
      stack.push(frame);
      id = parents.get(id);
    }
    const seen = new Set();
    for (let frameIndex = 0; frameIndex < stack.length; frameIndex += 1) {
      const frame = stack[frameIndex];
      const file = source(frame.url);
      const key = `${file}:${frame.lineNumber + 1}:${frame.functionName}`;
      const row = rows.get(key) ?? {
        function: frame.functionName || "(anonymous)",
        file,
        line: frame.lineNumber + 1,
        selfUs: 0,
        inclusiveUs: 0,
      };
      if (frameIndex === 0) row.selfUs += durationUs;
      if (!seen.has(key)) row.inclusiveUs += durationUs;
      seen.add(key);
      rows.set(key, row);
    }
    const hasFunction = (name) => stack.some((frame) => frame.functionName === name);
    let category = "other";
    if (hasFunction("(idle)")) category = "idle";
    else if (hasFunction("(garbage collector)")) category = "gc";
    else if (hasFunction("localDateTimeParts")) {
      category = hasFunction("deriveInstallmentLedger")
        ? "date-parts-ledger"
        : hasFunction("isDueInSaoPauloMonth")
          ? "date-parts-month-check"
          : "date-parts-other";
    } else if (hasFunction("deriveInstallmentLedger")) category = "ledger-other";
    else if (hasFunction("buildReceivablesSnapshot")) category = "snapshot-other";
    else if (hasFunction("receivablesSnapshot")) category = "snapshot-frame-unresolved";
    else if (stack.some((frame) => /(?:@prisma|pg-pool|pg-protocol|\/pg\/)/u.test(frame.url)))
      category = "database-client-other";
    categories.set(category, (categories.get(category) ?? 0) + durationUs);
  }
  const metrics = (durationUs) => ({
    sampledMs: round(durationUs / 1000),
    percent: round((durationUs / sampledUs) * 100),
  });
  const formatted = [...rows.values()].map(({ selfUs, inclusiveUs, ...row }) => ({
    ...row,
    self: metrics(selfUs),
    inclusive: metrics(inclusiveUs),
  }));
  return {
    profile: basename(path),
    samples: profile.samples.length,
    elapsedMs: round((profile.endTime - profile.startTime) / 1000),
    sampledMs: round(sampledUs / 1000),
    categories: [...categories]
      .sort((a, b) => b[1] - a[1])
      .map(([category, durationUs]) => ({ category, ...metrics(durationUs) })),
    topSelf: [...formatted].sort((a, b) => b.self.sampledMs - a.self.sampledMs).slice(0, 20),
    topInclusive: [...formatted]
      .filter((row) => row.file.startsWith("packages/"))
      .sort((a, b) => b.inclusive.sampledMs - a.inclusive.sampledMs)
      .slice(0, 20),
  };
}

const results = [];
for (const path of paths) results.push(summarize(JSON.parse(await readFile(path, "utf8")), path));
console.log(
  JSON.stringify({ schema: "lazuli.receivables-cpu-analysis.v1", profiles: results }, null, 2),
);
