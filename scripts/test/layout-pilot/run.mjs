import { execFile } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { promisify } from "node:util";
import { browserExpression } from "./browser.mjs";
import { controls, limits, mutations } from "./cases.mjs";

const {
  ORCA_CLI_COMMAND: orca = "orca-ide",
  LAYOUT_WEB_URL: web = "http://localhost:3000",
  LAYOUT_STORY_URL: storybook = "http://localhost:6006",
  LAYOUT_ARTIFACTS: evidence,
  LAYOUT_PAGE: existingPage,
  LAYOUT_CAPTURE_ID: captureId,
} = process.env;
const execute = promisify(execFile);
const scenarios = new Map(Object.entries(controls));
const defects = new Map(Object.entries(mutations));
const [mode = "check", name] = process.argv.slice(2);
let page = existingPage;

function print(record, output = process.stdout) {
  output.write(JSON.stringify(record) + "\n");
}

async function browser(command, ...args) {
  const { stdout } = await execute(orca, [...command.split(" "), ...args, "--json"], {
    timeout: 35_000,
    maxBuffer: 4 * 1024 * 1024,
  });
  const response = JSON.parse(stdout);
  if (!response.ok) throw new Error(JSON.stringify(response.error));
  return response.result;
}

async function create() {
  const result = await browser("tab create", "--url", "about:blank");
  return result.browserPageId;
}

async function close() {
  if (page && page !== existingPage) await browser("tab close", "--page", page);
  page = existingPage;
}

async function capture(id) {
  if (!evidence) return;
  try {
    mkdirSync(evidence, { recursive: true });
    const screenshot = await browser("screenshot", "--page", page);
    copyFileSync(screenshot.path, path.resolve(evidence, `${id}.png`));
  } catch (error) {
    print({ id, captureError: error.message }, process.stderr);
  }
}

function scenarioUrl({ surface, empty, story }) {
  if (surface === "modal") {
    return storybook + "/iframe.html?id=patterns-layoutqualitypilot--" + story + "&viewMode=story";
  }
  return web + "/alunos" + (empty ? "?busca=zzzxq-piloto-sem-resultado" : "");
}

async function evaluate(url, scenario) {
  try {
    await browser("goto", "--page", page, "--url", url);
    await browser(
      "viewport",
      "--page",
      page,
      "--width",
      String(scenario.width),
      "--height",
      String(scenario.height),
      "--scale",
      "1",
    );
    const response = await browser(
      "eval",
      "--page",
      page,
      "--expect-url",
      url,
      "--expression",
      browserExpression(scenario),
    );
    return JSON.parse(response.result);
  } catch (error) {
    const detail = error.stdout?.trim();
    return {
      executionError:
        detail ||
        `${error.code ?? error.signal ?? error.name}: ${error.message.split(" --expression ")[0]}`,
    };
  }
}

async function run(id, control, { enabled = true, screenshot } = {}) {
  const start = performance.now();
  const scenario = scenarios.get(control);
  const { width, height, surface } = scenario;
  const url = scenarioUrl(scenario);
  const result = await evaluate(url, { ...scenario, enabled, limits });
  const elapsedMs = Math.round(performance.now() - start);
  const record = { id, control, surface, url, width, height, enabled, elapsedMs, ...result };
  print(record);
  if (screenshot && !result.executionError) await capture(screenshot);
  return record;
}

function replace(file, from, to) {
  const current = readFileSync(file, "utf8");
  if (current.split(from).length !== 2) {
    throw new Error(`Expected exactly one patch anchor in ${file}: ${from}`);
  }
  writeFileSync(file, current.replace(from, to));
}

function passed(result, expected) {
  if (result.executionError) return false;
  if (!expected) return result.failures.length === 0;
  return result.failures.length === 1 && result.failures[0].id === expected;
}

async function mutant(id, screenshot) {
  const { control, expected, file, from, to } = defects.get(id);
  const original = readFileSync(file, "utf8");
  replace(file, from, to);
  let signalReceived;
  const restore = () => {
    replace(file, to, from);
    if (readFileSync(file, "utf8") !== original) {
      throw new Error(`Concurrent edit preserved in ${file}. Inspect the diff before continuing.`);
    }
  };
  const interrupted = (signal) => {
    signalReceived = signal;
    restore();
  };
  process.once("SIGINT", interrupted);
  process.once("SIGTERM", interrupted);
  let result;
  try {
    result = await run(id, control, { screenshot });
  } finally {
    process.off("SIGINT", interrupted);
    process.off("SIGTERM", interrupted);
    if (!signalReceived) restore();
    await execute("git", ["diff", "--check", "--", file]);
  }
  if (signalReceived) throw new Error(`Interrupted by ${signalReceived} after reverting ${id}`);
  return passed(result, expected);
}

async function sample({ phase, index, enabled, fresh = false }) {
  const sampleControls = ["desktop", "empty", "modal-narrow", "runtime-six"];
  const start = performance.now();
  if (fresh) page = await create();
  const tabMs = fresh ? Math.round(performance.now() - start) : 0;
  const results = [];
  const id = `${phase}-${index}-${enabled ? "on" : "off"}`;
  for (const control of sampleControls) results.push(await run(id, control, { enabled }));
  const setupMs = results.reduce((total, result) => total + (result.setupMs ?? 0), 0);
  const checkMs = results.reduce((total, result) => total + (result.checkMs ?? 0), 0);
  const success = results.every((result) => passed(result));
  print({
    sample: id,
    tabMs,
    setupMs,
    checkMs,
    passed: success,
    elapsedMs: Math.round(performance.now() - start),
  });
  if (fresh) await close();
  return success;
}

async function benchmark() {
  let ok = await sample({ phase: "cold-tab", index: 1, enabled: false, fresh: true });
  ok = (await sample({ phase: "cold-tab", index: 1, enabled: true, fresh: true })) && ok;
  page ??= await create();
  for (let index = 1; index <= 5; index++) {
    for (const enabled of [index % 2 === 0, index % 2 !== 0]) {
      ok = (await sample({ phase: "warm", index, enabled })) && ok;
    }
  }
  return ok;
}

async function checkControls(ids) {
  let ok = true;
  for (const id of ids) {
    const record = await run(id, id, { screenshot: id });
    ok = passed(record) && ok;
  }
  return ok;
}

async function matrix() {
  let ok = await checkControls(scenarios.keys());
  for (const id of defects.keys()) ok = (await mutant(id, id)) && ok;
  return ok;
}

async function main() {
  if (mode === "bench") return benchmark();
  page ??= await create();
  if (mode === "matrix") return matrix();
  if (mode === "mutant" && defects.has(name)) return mutant(name, captureId ?? name);
  if (mode === "check") {
    if (!name) return checkControls(scenarios.keys());
    if (scenarios.has(name)) return checkControls([name]);
  }
  throw new Error(
    "Usage: node scripts/test/layout-pilot/run.mjs [check [CONTROL] | matrix | mutant ID | bench]",
  );
}

try {
  process.exitCode = (await main()) ? 0 : 1;
} finally {
  await close();
}
