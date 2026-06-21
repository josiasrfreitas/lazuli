import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { ESLint } from "eslint";

import { createConfig } from "../base.js";

const fixturesDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const fixturePath = path.join(fixturesDirectory, "example.ts");
const repositoryRoot = path.join(fixturesDirectory, "../../../..");

async function lint(source, packageType = "base") {
  const eslint = new ESLint({
    cwd: fixturesDirectory,
    ignore: false,
    overrideConfig: createConfig({ packageType, tsconfigRootDir: fixturesDirectory }),
    overrideConfigFile: true,
  });
  const [result] = await eslint.lintText(source, { filePath: fixturePath });

  return result.messages;
}

function ruleIds(messages) {
  return messages.map(({ ruleId }) => ruleId);
}

async function lintWebSource(source) {
  const webDirectory = path.join(repositoryRoot, "apps/web");
  const eslint = new ESLint({
    cwd: webDirectory,
    ignore: false,
    overrideConfig: createConfig({ packageType: "web", tsconfigRootDir: webDirectory }),
    overrideConfigFile: true,
  });
  const [result] = await eslint.lintText(source, {
    filePath: path.join(webDirectory, "src/app/page.tsx"),
  });

  return result.messages;
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
