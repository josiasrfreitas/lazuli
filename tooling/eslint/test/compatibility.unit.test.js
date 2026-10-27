import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { it } from "node:test";

import { lintFiles } from "../run-oxlint.mjs";

const require = createRequire(import.meta.url);

it("retains the six Unicorn rules omitted by the automatic migration", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "lazuli-unicorn-parity-"));
  try {
    await writeFile(
      path.join(directory, "package.json"),
      JSON.stringify({ engines: { node: "22" } }),
    );
    const source = [
      'import "array-includes";',
      'import { default as readFile } from "node:fs";',
      // Multiple expiry dates are invalid even when CI ignores expired dates on PRs.
      "// TODO [2000-01-01, 2000-01-02]: remove this workaround",
      "function visit(items) { for (let index = 0; index < items.length; index++) { String(items[index]); } }",
      'function classify(value) { if (value === "one") return 1; else if (value === "two") return 2; else if (value === "three") return 3; }',
      "const template = html`first\nsecond`;",
    ].join("\n");
    const file = path.join(directory, "probe.js");
    await writeFile(file, source);
    const names = [
      "no-unnecessary-polyfills",
      "no-named-default",
      "expiring-todo-comments",
      "no-for-loop",
      "prefer-switch",
      "template-indent",
    ];
    const results = await lintFiles({
      cwd: directory,
      files: [file],
      suppress: false,
      config: {
        plugins: [],
        categories: { correctness: "off" },
        jsPlugins: [
          { name: "unicorn-compat", specifier: require.resolve("eslint-plugin-unicorn") },
        ],
        rules: Object.fromEntries(names.map((name) => [`unicorn-compat/${name}`, "error"])),
      },
    });
    const messages = results.flatMap((result) => result.messages);
    for (const name of names) {
      assert.ok(
        messages.some((message) => message.ruleId === `unicorn/${name}`),
        name,
      );
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
