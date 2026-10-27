import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { lintFiles } from "../run-oxlint.mjs";

import { createConfig } from "../oxlint-base.js";

const fixturesDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const repositoryRoot = path.join(fixturesDirectory, "../../../..");
const probeTsconfigFileName = "tsconfig.json";
const probeSourceFileName = "probe.ts";
const probeTsconfigContents = `${JSON.stringify(
  { extends: "../../../../tsconfig/base.json", include: ["**/*.ts"] },
  null,
  2,
)}\n`;

async function lintProbe({ directory, probePath, packageType }) {
  const results = await lintFiles({
    cwd: directory,
    files: [probePath],
    config: createConfig({ packageType, tsconfigRootDir: directory }),
    suppress: false,
    args: ["--no-ignore"],
  });
  return results.flatMap((result) => result.messages);
}

// Type-aware rules read types from disk. Each probe owns a real source file and
// tsconfig so imports and types are resolved from the same isolated project.
async function lintFixtureProbe({ directoryName, packageType, source, test = false }) {
  const projectDirectory = path.join(fixturesDirectory, directoryName);
  await mkdir(projectDirectory, { recursive: true });
  const probePath = path.join(projectDirectory, test ? "test/probe.ts" : probeSourceFileName);
  try {
    await mkdir(path.dirname(probePath), { recursive: true });
    await writeFile(path.join(projectDirectory, probeTsconfigFileName), probeTsconfigContents);
    await writeFile(probePath, source);
    return await lintProbe({ directory: projectDirectory, probePath, packageType });
  } finally {
    await rm(projectDirectory, { recursive: true, force: true });
  }
}

async function lintWebImportsProbe(source) {
  return await lintFixtureProbe({ directoryName: "probe-web-imports", packageType: "web", source });
}

async function lintJobContractsProbe(source) {
  return await lintFixtureProbe({
    directoryName: "probe-job-contracts",
    packageType: "job-contracts",
    source,
  });
}

async function lintFloatingPromisesProbe(source) {
  return await lintFixtureProbe({
    directoryName: "probe-floating-promises",
    packageType: "base",
    source,
  });
}

async function lintRestrictedTypesProbe(source) {
  return await lintFixtureProbe({
    directoryName: "probe-restricted-types",
    packageType: "base",
    source,
  });
}

async function lintMagicNumbersProbe(source) {
  return await lintFixtureProbe({
    directoryName: "probe-magic-numbers",
    packageType: "base",
    source,
  });
}

async function lintInlineDirectiveProbe(source) {
  return await lintFixtureProbe({
    directoryName: "probe-inline-directive",
    packageType: "base",
    source,
  });
}

function ruleIds(messages) {
  return messages.map(({ ruleId }) => ruleId);
}

// The relative-path zone in `import-x/no-restricted-paths` matches on physical
// location, so this probe must sit at a real app path (same depth as a page).
async function lintWebRestrictedPathsProbe(source) {
  const webDirectory = path.join(repositoryRoot, "apps/web");
  const probePath = path.join(webDirectory, "src/app/guardrail-probe-restricted-paths.tsx");
  await writeFile(probePath, source);
  try {
    return await lintProbe({ directory: webDirectory, probePath, packageType: "web" });
  } finally {
    await rm(probePath, { force: true });
  }
}

async function lintApiRestrictedPathsProbe(source) {
  const apiDirectory = path.join(repositoryRoot, "packages/api");
  const probePath = path.join(apiDirectory, "src/students/guardrail-probe-restricted-paths.ts");
  await writeFile(probePath, source);
  try {
    return await lintProbe({ directory: apiDirectory, probePath, packageType: "api" });
  } finally {
    await rm(probePath, { force: true });
  }
}

describe("shared Oxlint guardrails", () => {
  it("rejects Prisma and worker-handler imports from the web app", async () => {
    const messages = await lintWebImportsProbe(
      [
        'import type { PrismaClient } from "@prisma/client";',
        'import "@lazuli/worker-handlers";',
        "export type Client = PrismaClient;",
      ].join("\n"),
    );

    assert.equal(
      ruleIds(messages).filter((ruleId) => ruleId === "no-restricted-imports").length,
      2,
    );
  });

  it("rejects worker-handler imports from job contracts", async () => {
    const messages = await lintJobContractsProbe('import "@lazuli/worker-handlers";');

    assert.ok(ruleIds(messages).includes("no-restricted-imports"));
  });

  it("rejects relative paths that bypass package exports", async () => {
    const messages = await lintWebRestrictedPathsProbe(
      'import "../../../../packages/worker-handlers/src/index.js";',
    );

    assert.ok(ruleIds(messages).includes("import-x/no-restricted-paths"));
  });

  it("rejects finance internal imports outside the finance module", async () => {
    const messages = await lintApiRestrictedPathsProbe(
      [
        'import { ORDER_NOT_FOUND_MESSAGE } from "../finance/internal/shared.js";',
        "export const probe = ORDER_NOT_FOUND_MESSAGE;",
      ].join("\n"),
    );

    assert.ok(ruleIds(messages).includes("import-x/no-restricted-paths"));
  });

  it("uses type information to reject floating promises", async () => {
    const messages = await lintFloatingPromisesProbe('Promise.resolve("done");');

    assert.ok(ruleIds(messages).includes("@typescript-eslint/no-floating-promises"));
  });

  it("rejects new explicit unknown types", async () => {
    const messages = await lintRestrictedTypesProbe(
      "export function parse(value: unknown): string { return String(value); }",
    );

    assert.ok(ruleIds(messages).includes("@typescript-eslint/no-restricted-types"));
  });

  it("enforces readability rules", async () => {
    const messages = await lintMagicNumbersProbe("export function answer(): number { return 42; }");

    assert.ok(ruleIds(messages).includes("no-magic-numbers"));
  });

  it("allows inline directives to suppress rules", async () => {
    const messages = await lintInlineDirectiveProbe(
      ["// eslint-disable-next-line no-console", 'console.log("hidden");'].join("\n"),
    );

    assert.ok(!ruleIds(messages).includes("no-console"));
  });
});

it("allows literal, extensive test scenarios while retaining production readability rules", async () => {
  const source = [
    "export function scenario(): void {",
    ...Array.from({ length: 660 }, () => '  String(20.00001 + Number("repeated scenario value"));'),
    "  [1].map(() => [1].map(() => [1].map(() => [1].map(() => 1))));",
    "}",
  ].join("\n");
  const rules = [
    "no-magic-numbers",
    "unicorn/numeric-separators-style",
    "sonarjs/no-duplicate-string",
    "max-lines",
    "max-lines-per-function",
    "max-statements",
    "max-nested-callbacks",
  ];
  const production = ruleIds(
    await lintFixtureProbe({
      directoryName: "probe-production-policy",
      packageType: "base",
      source,
    }),
  );
  const tests = ruleIds(
    await lintFixtureProbe({
      directoryName: "probe-test-policy",
      packageType: "base",
      source,
      test: true,
    }),
  );
  for (const rule of rules) {
    assert.ok(production.includes(rule), `Production must enforce ${rule}`);
    assert.ok(!tests.includes(rule), `Tests must allow scenarios without ${rule}`);
  }
});

it("retains promise, type and import guardrails in dedicated tests", async () => {
  const messages = await lintFixtureProbe({
    directoryName: "probe-test-safety",
    packageType: "web",
    test: true,
    source: 'import "@lazuli/worker-handlers";\nPromise.resolve("done");\nexport type Input = any;',
  });
  const rules = ruleIds(messages);
  assert.ok(rules.includes("no-restricted-imports"));
  assert.ok(rules.includes("@typescript-eslint/no-floating-promises"));
  assert.ok(rules.includes("@typescript-eslint/no-explicit-any"));
});

it("enforces physical package and finance boundaries through production configs", async () => {
  const probes = [
    {
      directory: "apps/web",
      file: "src/app/production-boundary-probe.ts",
      source: 'import "../../../../packages/worker-handlers/src/index.js";',
    },
    {
      directory: "packages/api",
      file: "src/students/production-boundary-probe.ts",
      source:
        'import { ORDER_NOT_FOUND_MESSAGE } from "../finance/internal/shared.js"; export const probe = ORDER_NOT_FOUND_MESSAGE;',
    },
  ];
  for (const probe of probes) {
    const directory = path.join(repositoryRoot, probe.directory);
    const file = path.join(directory, probe.file);
    await writeFile(file, probe.source);
    try {
      const results = await lintFiles({ cwd: directory, files: [file] });
      assert.ok(
        results
          .flatMap((result) => result.messages)
          .some((message) => message.ruleId === "import-x/no-restricted-paths"),
        probe.directory,
      );
    } finally {
      await rm(file, { force: true });
    }
  }
});
