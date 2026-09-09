import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ESLint } from "eslint";

import { testQualityConfig } from "../test-quality.js";

const imports = [
  'import assert from "node:assert/strict";',
  'import { describe, it } from "node:test";',
].join("\n");

async function ruleIds(source) {
  const eslint = new ESLint({
    ignore: false,
    overrideConfig: testQualityConfig,
    overrideConfigFile: true,
  });
  const [result] = await eslint.lintText(source, { filePath: "probe.unit.test.ts" });
  return result.messages.map((message) => message.ruleId);
}

void describe("prospective test-quality rules", () => {
  it("rejects every high-confidence pattern in the gate contract", async () => {
    const probes = [
      ["node-test/no-assert-in-describe", `describe("suite", () => { assert.equal(1, 2); });`],
      ["node-test/no-standalone-assert", "assert.equal(1, 2);"],
      ["node-test/no-constant-assertion", `it("constant", () => { assert.ok(true); });`],
      [
        "node-test/no-identical-assertion-arguments",
        `it("self", () => { const value = Date.now(); assert.equal(value, value); });`,
      ],
      [
        "node-test/prefer-equality-assertion",
        `it("comparison", () => { const value = Date.now(); assert.ok(value === 1); });`,
      ],
      [
        "node-test/require-throws-expectation",
        `it("error", () => { assert.throws(() => { throw new Error("x"); }); });`,
      ],
      [
        "node-test/no-unawaited-promise-assertion",
        `it("promise", () => { Promise.resolve(1).then(value => assert.equal(value, 1)); });`,
      ],
      [
        "node-test/no-unawaited-rejects",
        `it("rejects", () => { assert.rejects(Promise.reject(new Error("x")), /x/u); });`,
      ],
      ["node-test/no-only-test", `it.only("focused", () => { assert.equal(1, 2); });`],
      [
        "node-test/no-skip-without-reason",
        `it("skipped", { skip: true }, () => { assert.equal(1, 2); });`,
      ],
      [
        "node-test/no-commented-tests",
        `// it("disabled", () => { assert.equal(1, 2); });\nit("live", () => { assert.equal(1, 2); });`,
      ],
      [
        "node-test/no-identical-title",
        `it("same", () => { assert.equal(1, 2); });\nit("same", () => { assert.equal(2, 3); });`,
      ],
      [
        "node-test/no-duplicate-assertions",
        `it("duplicate", () => { assert.equal(1, 2); assert.equal(1, 2); });`,
      ],
      [
        "node-test/no-async-fn-without-await",
        `it("async", async () => { assert.equal(1, 2); });`,
      ],
      ["lazuli-test/strict-assert-import", 'import assert from "node:assert";'],
    ];

    assert.equal(probes.length, 15);
    for (const [rule, source] of probes) {
      assert.ok((await ruleIds(`${imports}\n${source}`)).includes(rule), rule);
    }
  });

  it("emits every contextual pattern as a warning", async () => {
    const probes = [
      ["node-test/require-assertion", `it("empty", () => {});`],
      [
        "node-test/no-useless-assertion",
        `it("no throw", () => { assert.doesNotThrow(() => Date.now()); });`,
      ],
      [
        "node-test/no-conditional-assertion",
        `it("conditional assertion", () => { if (Date.now()) assert.equal(1, 2); });`,
      ],
      [
        "node-test/no-conditional-in-test",
        `it("conditional flow", () => { if (Date.now()) Date.now(); assert.equal(1, 2); });`,
      ],
      [
        "node-test/no-sleep-in-test",
        `it("sleep", async () => { await new Promise(resolve => setTimeout(resolve, 10)); assert.equal(1, 2); });`,
      ],
      [
        "lazuli-test/non-null-only",
        `it("non-null", () => { assert.notEqual(Date.now(), null); });`,
      ],
    ];

    assert.equal(probes.length, 6);
    for (const [rule, source] of probes) {
      assert.ok((await ruleIds(`${imports}\n${source}`)).includes(rule), rule);
    }
  });

  it("accepts helpers, parametrization, contractual mocks, and bounded polling", async () => {
    const source = `${imports}
const cases = [{ name: "one", input: 1, expected: 2 }];
function assertMapped(actual: number, expected: number) { assert.equal(actual, expected); }
for (const fixture of cases) {
  it(fixture.name, () => {
    const dependency = () => fixture.input + 1;
    assert.equal(dependency(), fixture.expected);
    assertMapped(dependency(), fixture.expected);
  });
}
it("polls Mailpit to a bounded deadline", async () => {
  const messages = await Promise.resolve([{ subject: "Welcome" }]);
  assert.equal(messages[0]?.subject, "Welcome");
});`;

    assert.deepEqual(await ruleIds(source), []);
  });
});
