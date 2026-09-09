import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const TEST_BUDGET_SECONDS = { integration: 0.5, transport: 1, unit: 0.05 };
const FILE_BUDGET_SECONDS = 5;
const reports = findReports();
if (reports.length === 0) fail("No JUnit reports found under apps/ or packages/");

const tests = reports.flatMap(readReport).toSorted((left, right) => right.seconds - left.seconds);
process.stdout.write("Ten slowest tests (informational):\n");
for (const test of tests.slice(0, 10)) {
  process.stdout.write(`  ${test.seconds.toFixed(3)}s  ${test.name} [${test.report}]\n`);
}

const overBudget = tests.filter((test) => test.seconds > TEST_BUDGET_SECONDS[test.tier]);
for (const test of overBudget) {
  process.stderr.write(
    `warning: ${test.name} took ${test.seconds.toFixed(3)}s; ${test.tier} budget is ` +
      `${TEST_BUDGET_SECONDS[test.tier]}s. Investigate repeated slowness; this run still passes.\n`,
  );
}

const fileDurations = new Map();
for (const test of tests) {
  if (!test.file) continue;
  const key = `${test.tier}:${test.file}`;
  fileDurations.set(key, (fileDurations.get(key) ?? 0) + test.seconds);
}
for (const [key, seconds] of fileDurations) {
  if (seconds <= FILE_BUDGET_SECONDS) continue;
  const separator = key.indexOf(":");
  const tier = key.slice(0, separator);
  const file = key.slice(separator + 1);
  process.stderr.write(
    `warning: ${file} took ${seconds.toFixed(3)}s across ${tier} tests; file budget is ` +
      `${FILE_BUDGET_SECONDS}s. Investigate repeated slowness; this run still passes.\n`,
  );
}

function findReports() {
  const found = [];
  for (const root of ["apps", "packages", "tooling"]) {
    if (!existsSync(root)) continue;
    for (const workspace of readdirSync(root, { withFileTypes: true })) {
      const reportDirectory = path.join(root, workspace.name, "reports", "junit");
      if (!workspace.isDirectory() || !existsSync(reportDirectory)) continue;
      for (const entry of readdirSync(reportDirectory, { withFileTypes: true })) {
        if (entry.isFile() && entry.name.endsWith(".xml")) {
          found.push(path.join(reportDirectory, entry.name));
        }
      }
    }
  }
  return found.toSorted();
}

function readReport(report) {
  const contents = readFileSync(report, "utf8");
  if (!contents.includes("<testsuites") || !contents.includes("</testsuites>")) {
    fail(`Invalid JUnit report: ${report}`);
  }
  const tier = /\/(unit|integration|transport)\.xml$/u.exec(report)?.[1];
  if (!tier) fail(`Cannot infer tier from JUnit report: ${report}`);
  const cases = [];
  const expression = /<testcase\b([^>]*)>/gu;
  for (const match of contents.matchAll(expression)) {
    const name = attribute(match[1], "name");
    const time = attribute(match[1], "time");
    const file = attribute(match[1], "file");
    const seconds = Number(time);
    if (!name || time === undefined || !Number.isFinite(seconds) || seconds < 0) {
      fail(`Invalid testcase in JUnit report: ${report}`);
    }
    cases.push({ file, name, report, seconds, tier });
  }
  if (cases.length === 0) fail(`JUnit report has no testcases: ${report}`);
  return cases;
}

function attribute(attributes, name) {
  return new RegExp(`(?:^|\\s)${name}="([^"]*)"`, "u").exec(attributes)?.[1];
}

function fail(message) {
  process.stderr.write(`${message}. See docs/testing/README.md.\n`);
  process.exit(2);
}
