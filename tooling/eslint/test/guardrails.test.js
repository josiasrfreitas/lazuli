import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { ESLint } from "eslint";

import { createConfig } from "../base.js";

const fixturesDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const repositoryRoot = path.join(fixturesDirectory, "../../../..");
const probeTsconfigFileName = "tsconfig.json";
const probeSourceFileName = "probe.ts";
const probeTsconfigContents = `${JSON.stringify(
  { extends: "../../../../tsconfig/base.json", include: ["*.ts"] },
  null,
  2,
)}\n`;

async function lintProbe({ directory, probePath, packageType }) {
  const eslint = new ESLint({
    cwd: directory,
    ignore: false,
    overrideConfig: createConfig({ packageType, tsconfigRootDir: directory }),
    overrideConfigFile: true,
  });
  const [result] = await eslint.lintFiles([probePath]);

  return result.messages;
}

// Type-aware rules read types from the file on disk, so the probe must be a real
// file in the package's tsconfig. typescript-eslint reuses one program per tsconfig
// path for the whole process (single-run mode under CI), which serves stale types
// for a reused path and "file not found" for a new one. Each test uses a dedicated
// probe directory name so every lint builds a fresh program from the just-written probe.
async function lintWebImportsProbe(source) {
  const projectDirectory = path.join(fixturesDirectory, "probe-web-imports");
  await mkdir(projectDirectory, { recursive: true });
  const probePath = path.join(projectDirectory, probeSourceFileName);
  try {
    await writeFile(path.join(projectDirectory, probeTsconfigFileName), probeTsconfigContents);
    await writeFile(probePath, source);
    return await lintProbe({ directory: projectDirectory, probePath, packageType: "web" });
  } finally {
    await rm(projectDirectory, { recursive: true, force: true });
  }
}

async function lintJobContractsProbe(source) {
  const projectDirectory = path.join(fixturesDirectory, "probe-job-contracts");
  await mkdir(projectDirectory, { recursive: true });
  const probePath = path.join(projectDirectory, probeSourceFileName);
  try {
    await writeFile(path.join(projectDirectory, probeTsconfigFileName), probeTsconfigContents);
    await writeFile(probePath, source);
    return await lintProbe({
      directory: projectDirectory,
      probePath,
      packageType: "job-contracts",
    });
  } finally {
    await rm(projectDirectory, { recursive: true, force: true });
  }
}

async function lintFloatingPromisesProbe(source) {
  const projectDirectory = path.join(fixturesDirectory, "probe-floating-promises");
  await mkdir(projectDirectory, { recursive: true });
  const probePath = path.join(projectDirectory, probeSourceFileName);
  try {
    await writeFile(path.join(projectDirectory, probeTsconfigFileName), probeTsconfigContents);
    await writeFile(probePath, source);
    return await lintProbe({ directory: projectDirectory, probePath, packageType: "base" });
  } finally {
    await rm(projectDirectory, { recursive: true, force: true });
  }
}

async function lintMagicNumbersProbe(source) {
  const projectDirectory = path.join(fixturesDirectory, "probe-magic-numbers");
  await mkdir(projectDirectory, { recursive: true });
  const probePath = path.join(projectDirectory, probeSourceFileName);
  try {
    await writeFile(path.join(projectDirectory, probeTsconfigFileName), probeTsconfigContents);
    await writeFile(probePath, source);
    return await lintProbe({ directory: projectDirectory, probePath, packageType: "base" });
  } finally {
    await rm(projectDirectory, { recursive: true, force: true });
  }
}

async function lintInlineDirectiveProbe(source) {
  const projectDirectory = path.join(fixturesDirectory, "probe-inline-directive");
  await mkdir(projectDirectory, { recursive: true });
  const probePath = path.join(projectDirectory, probeSourceFileName);
  try {
    await writeFile(path.join(projectDirectory, probeTsconfigFileName), probeTsconfigContents);
    await writeFile(probePath, source);
    return await lintProbe({ directory: projectDirectory, probePath, packageType: "base" });
  } finally {
    await rm(projectDirectory, { recursive: true, force: true });
  }
}

function ruleIds(messages) {
  return messages.map(({ ruleId }) => ruleId);
}

// The relative-path zone in `import/no-restricted-paths` matches on physical
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

describe("shared ESLint guardrails", () => {
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

    assert.ok(ruleIds(messages).includes("import/no-restricted-paths"));
  });

  it("uses type information to reject floating promises", async () => {
    const messages = await lintFloatingPromisesProbe('Promise.resolve("done");');

    assert.ok(ruleIds(messages).includes("@typescript-eslint/no-floating-promises"));
  });

  it("enforces readability rules", async () => {
    const messages = await lintMagicNumbersProbe("export function answer(): number { return 42; }");

    assert.ok(ruleIds(messages).includes("no-magic-numbers"));
  });

  it("does not allow inline directives to suppress guardrails", async () => {
    const messages = await lintInlineDirectiveProbe(
      ["// eslint-disable-next-line no-console", 'console.log("hidden");'].join("\n"),
    );

    assert.ok(ruleIds(messages).includes("no-console"));
  });
});
