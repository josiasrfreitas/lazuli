import { runAffectedChecks } from "./lib/affected-checks.mjs";

await runAffectedChecks({
  mode: "tests",
  staged: process.argv.includes("--staged"),
  unitOnly: process.argv.includes("--unit-only"),
});
