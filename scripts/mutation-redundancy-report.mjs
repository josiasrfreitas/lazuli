import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const reports = findReports();
if (reports.length === 0) fail("No Stryker JSON report found");
for (const report of reports) summarize(report);

function findReports() {
  const found = [];
  for (const root of ["apps", "packages"]) {
    if (!existsSync(root)) continue;
    for (const workspace of readdirSync(root, { withFileTypes: true })) {
      if (!workspace.isDirectory()) continue;
      const report = path.join(root, workspace.name, "reports", "mutation", "report.json");
      if (existsSync(report)) found.push(report);
    }
  }
  return found.toSorted();
}

function summarize(report) {
  const payload = readReport(report);
  const mutants = Object.values(payload.files).flatMap((file) => file.mutants);
  const exclusivelyKilling = new Set(
    mutants.flatMap((mutant) =>
      mutant.status === "Killed" && mutant.killedBy?.length === 1 ? mutant.killedBy : [],
    ),
  );
  const tests = Object.entries(payload.testFiles).map(([fileName, testFile]) => ({
    ids: (testFile.tests ?? []).map((test) => test.id),
    name: fileName,
  }));
  process.stdout.write(`${report}: files with no exclusive mutant kill (informational):\n`);
  for (const test of tests.filter(({ ids }) => !ids.some((id) => exclusivelyKilling.has(id)))) {
    process.stdout.write(`  ${test.name}\n`);
  }
}

function readReport(report) {
  let payload;
  try {
    payload = JSON.parse(readFileSync(report, "utf8"));
  } catch {
    fail(`Invalid Stryker JSON report: ${report}`);
  }
  if (
    !payload ||
    typeof payload !== "object" ||
    !isRecord(payload.files) ||
    !isRecord(payload.testFiles)
  ) {
    fail(`Invalid Stryker schema: ${report}`);
  }
  const fileRecords = Object.values(payload.files);
  const testFileRecords = Object.values(payload.testFiles);
  if (
    fileRecords.some((file) => !isRecord(file) || !Array.isArray(file.mutants)) ||
    testFileRecords.some((file) => !isRecord(file) || !Array.isArray(file.tests))
  ) {
    fail(`Invalid Stryker schema: ${report}`);
  }
  const mutants = fileRecords.flatMap((file) => file.mutants);
  if (
    mutants.some(
      (mutant) =>
        !isRecord(mutant) ||
        typeof mutant.status !== "string" ||
        (mutant.killedBy !== undefined && !Array.isArray(mutant.killedBy)),
    ) ||
    testFileRecords.some((file) =>
      file.tests.some((test) => !isRecord(test) || typeof test.id !== "string"),
    )
  ) {
    fail(`Invalid Stryker schema: ${report}`);
  }
  return payload;
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function fail(message) {
  process.stderr.write(`${message}; the redundancy tool cannot produce a valid report.\n`);
  process.exit(2);
}
