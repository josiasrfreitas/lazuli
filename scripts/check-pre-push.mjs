import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { URL } from "node:url";
import { readOption, resolveBaseRef } from "./changed-source-files.mjs";
import { getGitIndependentProcessEnvironment } from "./config.mjs";

// Reuse the isolated JS compiler API; the root TypeScript 7 package is native.
const require = createRequire(new URL("../tooling/eslint/package.json", import.meta.url));
const ts = require("typescript");
const env = getGitIndependentProcessEnvironment();
const git = (args) => execFileSync("git", args, { encoding: "utf8", env });
const base = resolveBaseRef(readOption("base"));
const mergeBase = git(["merge-base", base, "HEAD"]).trim();
const files = git(["diff", "--name-only", "-z", "--diff-filter=ACMR", mergeBase, "HEAD"])
  .split("\0")
  .filter(Boolean);
const sourcePattern = /\.(?:[cm]?[jt]s|[jt]sx)$/u;
const componentPattern = /^(?:apps\/web\/src|packages\/ui\/src\/components)\/.*\.tsx$/u;
const maximumComponentLines = 200;
let checked = 0;
const errors = [];
for (const file of files) {
  if (!sourcePattern.test(file) && !file.endsWith(".json")) continue;
  // Validate the committed content, never a staged/unstaged replacement of it.
  const source = git(["show", `HEAD:${file}`]);
  checked += 1;
  if (file.endsWith(".json")) {
    try {
      JSON.parse(source);
    } catch (error) {
      errors.push(`${file}: ${error.message}`);
    }
  } else {
    const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest);
    for (const diagnostic of parsed.parseDiagnostics) {
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
      errors.push(`${file}: ${message}`);
    }
  }
  if (componentPattern.test(file) && !file.includes(".stories.")) {
    const lines = source.split(/\r?\n/u).length;
    if (lines > maximumComponentLines)
      errors.push(`${file}: ${lines} lines; component limit is ${maximumComponentLines}.`);
  }
}
if (errors.length > 0) throw new Error(errors.join("\n"));
process.stdout.write(`Pre-push syntax/component checks passed (${checked} committed files).\n`);
