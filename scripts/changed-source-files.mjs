import { execFileSync } from "node:child_process";

const WORKSPACE_SOURCE_PATTERN = /^(apps|packages)\/[^/]+\/src\/.+\.(ts|tsx)$/u;
const EXCLUDED_SOURCE_PATTERN = /(\.d\.ts$|\.stories\.tsx?$|\/generated\/)/u;

function git(args) {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_")),
  );
  return execFileSync("git", args, { encoding: "utf8", env }).trim();
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

function fetchRef(ref) {
  try {
    const env = Object.fromEntries(
      Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_")),
    );
    execFileSync("git", ["fetch", "--quiet", "origin", ref], { env, stdio: "ignore" });
    return refExists(`origin/${ref}`);
  } catch {
    return false;
  }
}

/**
 * Picks the comparison base: an explicit ref, else the pull-request base branch that GitHub
 * Actions exposes as GITHUB_BASE_REF (fetched if the checkout is shallow), else origin/main,
 * else main.
 */
export function resolveBaseRef(explicitRef) {
  if (explicitRef) return explicitRef;

  const pullRequestBase = process.env.GITHUB_BASE_REF;
  if (pullRequestBase && (refExists(`origin/${pullRequestBase}`) || fetchRef(pullRequestBase))) {
    return `origin/${pullRequestBase}`;
  }

  if (refExists("origin/main") || fetchRef("main")) return "origin/main";
  if (refExists("main")) return "main";

  throw new Error(
    "Cannot resolve a comparison base: pass --base <ref> or fetch origin/main first.",
  );
}

/** Lists committed files since the merge base. Local working-tree changes are deliberately absent. */
export function listCommittedFiles(baseRef) {
  const mergeBase = git(["merge-base", baseRef, "HEAD"]);
  return gitLines(["diff", "--name-only", "--diff-filter=ACMRD", mergeBase, "HEAD"]);
}

/** Lists files in the index, independently of unstaged and untracked files. */
export function listStagedFiles() {
  return gitLines(["diff", "--cached", "--name-only", "--diff-filter=ACMRD"]);
}

/** Lists committed and local changes for interactive/CI-oriented analysis commands. */
export function listChangedFiles(baseRef) {
  const committed = listCommittedFiles(baseRef);
  const uncommitted = gitLines(["diff", "--name-only", "--diff-filter=ACMRD", "HEAD"]);
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
