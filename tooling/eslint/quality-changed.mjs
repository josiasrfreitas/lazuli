import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

import { ESLint } from "eslint";
import tseslint from "typescript-eslint";

import { testQualityConfig } from "./test-quality.js";

const TEST_FILE_PATTERN = /(?:^|\/)test\/.*\.test\.[cm]?[jt]sx?$/u;
const GUIDE = "docs/testing/README.md";

function git(args) {
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_")),
  );
  return execFileSync("git", args, { encoding: "utf8", env: environment }).trim();
}

function lines(args) {
  const output = git(args);
  return output === "" ? [] : output.split("\n");
}

function option(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const mergeBase = process.argv.includes("--staged")
  ? undefined
  : git(["merge-base", option("base") ?? "origin/main", "HEAD"]);

function changedTestFiles() {
  if (process.argv.includes("--staged")) {
    return lines(["diff", "--cached", "--name-only", "--diff-filter=ACMR"]).filter((file) =>
      TEST_FILE_PATTERN.test(file),
    );
  }

  const tracked = lines(["diff", "--name-only", "--diff-filter=ACMR", mergeBase]).filter((file) =>
    TEST_FILE_PATTERN.test(file),
  );
  const untracked = lines(["ls-files", "--others", "--exclude-standard"]).filter((file) =>
    TEST_FILE_PATTERN.test(file),
  );
  return [...new Set([...tracked, ...untracked])].toSorted();
}

function isNewFile(file) {
  if (process.argv.includes("--staged")) {
    return lines(["diff", "--cached", "--name-only", "--diff-filter=A", "--", file]).length > 0;
  }
  return lines(["ls-tree", "--name-only", mergeBase, "--", file]).length === 0;
}

function changedLines(file) {
  const diffArgs = process.argv.includes("--staged")
    ? ["diff", "--cached", "--unified=0", "--", file]
    : ["diff", "--unified=0", mergeBase, "--", file];
  const changed = new Set();
  for (const line of git(diffArgs).split("\n")) {
    const match = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/u.exec(line);
    if (!match) continue;
    const start = Number(match[1]);
    const count = Number(match[2] ?? "1");
    for (let current = start; current < start + count; current += 1) changed.add(current);
  }
  return changed;
}

function testRanges(source) {
  const { ast } = tseslint.parser.parseForESLint(source, {
    ecmaVersion: "latest",
    loc: true,
    range: true,
    sourceType: "module",
  });
  const ranges = [];
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "CallExpression" && isTestCall(node)) {
      ranges.push([node.loc.start.line, node.loc.end.line]);
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === "parent" || key === "loc" || key === "range") continue;
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === "object" && "type" in value) visit(value);
    }
  };
  visit(ast);
  return ranges;
}

function isTestCall(node) {
  if (node.callee.type === "Identifier")
    return node.callee.name === "it" || node.callee.name === "test";
  return (
    node.callee.type === "MemberExpression" &&
    node.callee.object.type === "Identifier" &&
    (node.callee.object.name === "it" || node.callee.object.name === "test")
  );
}

function relevantLines(file, source) {
  if (isNewFile(file)) return null;
  const changed = changedLines(file);
  const relevant = new Set(changed);
  for (const [start, end] of testRanges(source)) {
    if ([...changed].some((line) => line >= start && line <= end)) {
      for (let line = start; line <= end; line += 1) relevant.add(line);
    }
  }
  return relevant;
}

const files = changedTestFiles();
if (files.length === 0) {
  process.stdout.write("No changed test files for the prospective quality gate.\n");
  process.exit(0);
}

const eslint = new ESLint({
  cwd: process.cwd(),
  ignore: false,
  overrideConfig: testQualityConfig,
  overrideConfigFile: true,
});
let errors = 0;
let warnings = 0;

for (const file of files) {
  const source = process.argv.includes("--staged")
    ? git(["show", `:${file}`])
    : readFileSync(file, "utf8");
  const relevant = relevantLines(file, source);
  const [result] = await eslint.lintText(source, { filePath: path.resolve(file) });
  for (const message of result.messages) {
    if (relevant && !relevant.has(message.line)) continue;
    const level = message.severity === 2 ? "error" : "warning";
    if (message.severity === 2) errors += 1;
    else warnings += 1;
    process.stderr.write(
      `${file}:${message.line}:${message.column} ${level} ${message.message} ` +
        `[${message.ruleId ?? "parse-error"}] See ${GUIDE}.\n`,
    );
  }
}

process.stdout.write(`Test quality gate: ${errors} error(s), ${warnings} contextual warning(s).\n`);
if (errors > 0) process.exitCode = 1;
