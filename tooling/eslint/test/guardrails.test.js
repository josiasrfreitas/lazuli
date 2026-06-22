import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { ESLint } from "eslint";

import { createConfig } from "../base.js";

const fixturesDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const repositoryRoot = path.join(fixturesDirectory, "../../../..");

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
// for a reused path and "file not found" for a new one. Giving each call its own
// temp project (unique tsconfig) sidesteps both: every lint builds a fresh program
// from the just-written probe.
async function lint(source, packageType = "base") {
  const projectDirectory = path.join(fixturesDirectory, `probe-${randomUUID()}`);
  await mkdir(projectDirectory);
  try {
    await writeFile(
      path.join(projectDirectory, "tsconfig.json"),
      `${JSON.stringify({ extends: "../../../../tsconfig/base.json", include: ["*.ts"] }, null, 2)}\n`,
    );
    const probePath = path.join(projectDirectory, "probe.ts");
    await writeFile(probePath, source);

    return await lintProbe({ directory: projectDirectory, probePath, packageType });
  } finally {
    await rm(projectDirectory, { recursive: true, force: true });
  }
}

function ruleIds(messages) {
  return messages.map(({ ruleId }) => ruleId);
}

// The relative-path zone in `import/no-restricted-paths` matches on physical
// location, so this probe must sit at a real app path (same depth as a page).
async function lintWebSource(source) {
  const webDirectory = path.join(repositoryRoot, "apps/web");
  const probePath = path.join(webDirectory, "src/app", `probe-${randomUUID()}.tsx`);
  await writeFile(probePath, source);
  try {
    return await lintProbe({ directory: webDirectory, probePath, packageType: "web" });
  } finally {
    await rm(probePath, { force: true });
  }
}

describe("shared ESLint guardrails", () => {
  it("rejects Prisma and worker-handler imports from the web app", async () => {
    const messages = await lint(
      [
        'import type { PrismaClient } from "@prisma/client";',
        'import "@lazuli/worker-handlers";',
        "export type Client = PrismaClient;",
      ].join("\n"),
      "web",
    );

    assert.equal(
      ruleIds(messages).filter((ruleId) => ruleId === "no-restricted-imports").length,
      2,
    );
  });

  it("rejects worker-handler imports from job contracts", async () => {
    const messages = await lint('import "@lazuli/worker-handlers";', "job-contracts");

    assert.ok(ruleIds(messages).includes("no-restricted-imports"));
  });

  it("rejects relative paths that bypass package exports", async () => {
    const messages = await lintWebSource(
      'import "../../../../packages/worker-handlers/src/index.js";',
    );

    assert.ok(ruleIds(messages).includes("import/no-restricted-paths"));
  });

  it("uses type information to reject floating promises", async () => {
    const messages = await lint('Promise.resolve("done");');

    assert.ok(ruleIds(messages).includes("@typescript-eslint/no-floating-promises"));
  });

  it("enforces readability rules", async () => {
    const messages = await lint("export function answer(): number { return 42; }");

    assert.ok(ruleIds(messages).includes("no-magic-numbers"));
  });

  it("does not allow inline directives to suppress guardrails", async () => {
    const messages = await lint(
      ["// eslint-disable-next-line no-console", 'console.log("hidden");'].join("\n"),
    );

    assert.ok(ruleIds(messages).includes("no-console"));
  });
});
