// The package command owns the unit-covered score gate; Stryker's raw score includes NoCoverage.
import { spawnSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";

const reportPath = "reports/mutation/report.json";
rmSync(reportPath, { force: true });
const result = spawnSync("stryker", ["run", ...process.argv.slice(2)], { stdio: "inherit" });
if (result.status !== 0) process.exit(result.status ?? 1);

const report = JSON.parse(readFileSync(reportPath, "utf8"));
const mutants = Object.values(report.files).flatMap((file) => file.mutants);
const detected = mutants.filter((mutant) => ["Killed", "Timeout"].includes(mutant.status)).length;
const survived = mutants.filter((mutant) => mutant.status === "Survived").length;
const uncovered = mutants.filter((mutant) => mutant.status === "NoCoverage").length;
const invalid = mutants.filter(
  (mutant) =>
    !["Killed", "Timeout", "Survived", "NoCoverage", "Ignored", "CompileError"].includes(
      mutant.status,
    ),
);
if (invalid.length > 0) {
  process.stderr.write("Mutation execution failed: runtime errors or unfinished mutant results.\n");
  process.exit(1);
}
const total = detected + survived;
if (total === 0) {
  process.stdout.write(
    `Unit-covered mutation score: N/A (no scored mutants; ${uncovered} uncovered excluded).\n`,
  );
} else {
  const score = (detected / total) * 100;
  process.stdout.write(
    `Unit-covered mutation score: ${score.toFixed(2)}% (${detected}/${total}; ${uncovered} uncovered excluded). Required: 70%.\n`,
  );
  if (score < 70) process.exitCode = 1;
}
