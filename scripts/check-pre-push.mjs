import { runAffectedChecks } from "./lib/affected-checks.mjs";

await runAffectedChecks({ mode: "pre-push" });
