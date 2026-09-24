import { execFileSync } from "node:child_process";
import { getGitIndependentProcessEnvironment } from "./config.mjs";

// Formatting is handled once by Lefthook, before this index-only check.
execFileSync("git", ["diff", "--cached", "--check"], {
  stdio: "inherit",
  env: getGitIndependentProcessEnvironment(),
});
process.stdout.write("Pre-commit whitespace check passed.\n");
