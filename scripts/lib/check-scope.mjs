import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const GLOBAL_CONFIGURATION = new Set([
  ".npmrc",
  ".nvmrc",
  ".env.example",
  "docker-compose.yml",
  "eslint.config.js",
  "jscpd.json",
  "lefthook.yml",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "tsconfig.json",
  "turbo.json",
]);
const REPORTING_SCRIPTS = new Set([
  "scripts/changed-source-files.mjs",
  "scripts/check-pre-commit.mjs",
  "scripts/check-pre-push.mjs",
  "scripts/gh-pending.mjs",
  "scripts/test-affected.mjs",
  "scripts/lib/affected-checks.mjs",
  "scripts/lib/check-scope.mjs",
  "scripts/lib/ephemeral-test-database.mjs",
  "scripts/config.mjs",
  "scripts/style-test-utils.mjs",
  "scripts/guardrails/hook-input.mjs",
  "scripts/guardrails/lint-edited-file.mjs",
  "scripts/guardrails/protect-files.mjs",
  "scripts/mutate-changed.mjs",
  "scripts/run-test-tier.mjs",
  "scripts/run-unit-mutation.mjs",
  "scripts/mutation-cache-key.mjs",
  "scripts/test-durations.mjs",
  "scripts/mutation-redundancy-report.mjs",
  "scripts/test-component-lines.mjs",
  "scripts/test-component-contracts.mjs",
  "scripts/test-styles.mjs",
]);
const LIGHT_SCRIPTS = new Set([
  "scripts/storybook.mjs",
  "scripts/development.mjs",
  "scripts/capture-mock-screenshots.mjs",
  "scripts/kill-stale-chrome-devtools-mcp.sh",
  "scripts/workspace-status.mjs",
  "scripts/lib/workspace-proxy.mjs",
  "scripts/lib/workspace-metadata.mjs",
  "scripts/runtime-check.mjs",
  "scripts/runtime-env.mjs",
  "scripts/turbo-env-check.mjs",
]);
const FULL_WORKSPACE_SCRIPTS = new Set([
  "orca.yaml",
  "scripts/workspace-setup.mjs",
  "scripts/workspace-reset.mjs",
  "scripts/workspace-fixtures.mjs",
  "scripts/workspace-teardown.mjs",
  "scripts/workspace-gc.mjs",
  "scripts/seed-gcs.sh",
  "scripts/bootstrap-worktree.sh",
  "scripts/lib/workspace-full.mjs",
  "scripts/lib/workspace-gcs.mjs",
  "scripts/lib/worktree-db.sh",
  "scripts/lib/worktree-gcs.sh",
  "scripts/lib/docker-engines.sh",
  "scripts/lib/local-workspace-initialization.mjs",
  "scripts/lib/workspace-maintenance.mjs",
  "scripts/lib/workspace-reset-confirmation.mjs",
  "scripts/lib/workspace-resource-guard.mjs",
  "scripts/lib/workspace-teardown.mjs",
  "scripts/lib/workspace-gc.mjs",
  "scripts/git-hooks/post-checkout-worktree.sh",
]);
const SCRIPT_CATEGORIES = new Set([
  "root-guardrail",
  "workspace-light",
  "workspace-full",
  "ci-workflow",
]);
const DOC_PATTERN = /^(docs\/|[^/]+\.md$|\.design\/)/u;
const WORKSPACE_PATTERN = /^(apps|packages|tooling)\/[^/]+(?:\/|$)/u;
const DB_SCHEMA_PATTERN = /^packages\/db\/(prisma\/|src\/seed)|^scripts\/seed\.ts$/u;
const CI_PATTERN = /^\.github\/(workflows|pullfrog)\//u;

export function classifyChanges(files, { root = process.cwd() } = {}) {
  const categories = new Set();
  const workspaceDirectories = new Set();
  const unknown = [];

  for (const file of files) {
    if (DOC_PATTERN.test(file)) categories.add("documentation");
    else if (GLOBAL_CONFIGURATION.has(file)) categories.add("global-configuration");
    else if (DB_SCHEMA_PATTERN.test(file)) {
      categories.add("database-schema");
      workspaceDirectories.add("packages/db");
    } else if (WORKSPACE_PATTERN.test(file)) {
      const directory = file.split("/").slice(0, 2).join("/");
      if (existsSync(path.join(root, directory, "package.json"))) {
        categories.add("workspace");
        workspaceDirectories.add(directory);
      } else unknown.push(file);
    } else if (REPORTING_SCRIPTS.has(file) || file.startsWith("scripts/test/")) {
      categories.add("root-guardrail");
    } else if (LIGHT_SCRIPTS.has(file)) categories.add("workspace-light");
    else if (FULL_WORKSPACE_SCRIPTS.has(file)) categories.add("workspace-full");
    else if (CI_PATTERN.test(file) || file === ".github/workflows/pullfrog.yml") {
      categories.add("ci-workflow");
    } else if (file.startsWith("scripts/") || file.startsWith(".github/")) unknown.push(file);
    else if (/\.(json|ya?ml|mjs|cjs|js|ts|tsx|sh)$/u.test(file)) unknown.push(file);
    else categories.add("documentation");
  }

  if (unknown.length > 0) {
    throw new Error(
      `Unclassified executable file(s): ${unknown.join(", ")}. Add an impact rule before continuing.`,
    );
  }

  const all = categories.has("global-configuration");
  const database = all || categories.has("database-schema");
  return {
    files: [...files],
    categories: [...categories].toSorted(),
    workspaceDirectories: [...workspaceDirectories].toSorted(),
    all,
    rootChecks: all || [...categories].some((value) => SCRIPT_CATEGORIES.has(value)),
    scriptTests: all || [...categories].some((value) => SCRIPT_CATEGORIES.has(value)),
    workspaceIntegration: categories.has("workspace-full"),
    forceInfrastructureTiers: database,
  };
}

export function workspaceFilters(scope, { root = process.cwd() } = {}) {
  if (scope.all) return [];
  return scope.workspaceDirectories.map((directory) => {
    const manifest = JSON.parse(readFileSync(path.join(root, directory, "package.json"), "utf8"));
    return `--filter=...${manifest.name}`;
  });
}

export function packageDirectory(packageName, { root = process.cwd() } = {}) {
  for (const scope of ["apps", "packages", "tooling"]) {
    const parent = path.join(root, scope);
    if (!existsSync(parent)) continue;
    for (const entry of readdirSync(parent)) {
      const directory = path.join(parent, entry);
      const manifestPath = path.join(directory, "package.json");
      if (
        existsSync(manifestPath) &&
        JSON.parse(readFileSync(manifestPath, "utf8")).name === packageName
      )
        return directory;
    }
  }
}
