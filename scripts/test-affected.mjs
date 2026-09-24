import { runAffectedChecks } from "./lib/affected-checks.mjs";

await runAffectedChecks({
  staged: process.argv.includes("--staged"),
  unitOnly: process.argv.includes("--unit-only"),
});
