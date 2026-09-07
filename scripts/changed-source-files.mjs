import { execFileSync } from "node:child_process";

const WORKSPACE_SOURCE_PATTERN = /^(apps|packages)\/[^/]+\/src\/.+\.(ts|tsx)$/u;
const EXCLUDED_SOURCE_PATTERN = /(\.d\.ts$|\.stories\.tsx?$|\/generated\/)/u;

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function gitLines(args) {
  const output = git(args);
  return output === "" ? [] : output.split("\n");
}

function refExists(ref) {
  try {
    git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

/** Picks the comparison base: an explicit ref, else origin/main, else main. */
export function resolveBaseRef(explicitRef) {
  if (explicitRef) return explicitRef;
  return refExists("origin/main") ? "origin/main" : "main";
}

/** Lists files added or modified since the merge base with `baseRef`, including uncommitted work. */
export function listChangedFiles(baseRef) {
  const mergeBase = git(["merge-base", baseRef, "HEAD"]);
  const committed = gitLines(["diff", "--name-only", "--diff-filter=ACMR", mergeBase, "HEAD"]);
  const uncommitted = gitLines(["diff", "--name-only", "--diff-filter=ACMR", "HEAD"]);
  const untracked = gitLines(["ls-files", "--others", "--exclude-standard"]);

  return [...new Set([...committed, ...uncommitted, ...untracked])].toSorted();
}

/**
 * Groups changed production source files by workspace package directory
 * (`apps/<name>` or `packages/<name>`), with paths relative to that package.
 *
 * @param {string[]} files
 * @returns {Map<string, string[]>}
 */
export function groupSourceFilesByPackage(files) {
  const groups = new Map();

  for (const file of files) {
    if (!WORKSPACE_SOURCE_PATTERN.test(file) || EXCLUDED_SOURCE_PATTERN.test(file)) continue;

    const [scope, name, ...rest] = file.split("/");
    const packageDirectory = `${scope}/${name}`;
    const relativePath = rest.join("/");
    const existing = groups.get(packageDirectory) ?? [];
    groups.set(packageDirectory, [...existing, relativePath]);
  }

  return groups;
}

/** Reads `--name value` style options from argv. */
export function readOption(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}
