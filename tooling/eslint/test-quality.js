import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

const strictAssertRule = {
  meta: {
    messages: { strict: "Import assertions from node:assert/strict, not node:assert." },
    schema: [],
    type: "problem",
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        if (node.source.value === "node:assert") context.report({ node, messageId: "strict" });
      },
    };
  },
};

const nonNullOnlyRule = {
  meta: {
    messages: {
      weak: "A non-null-only assertion is contextual evidence; add a stronger contract check.",
    },
    schema: [],
    type: "suggestion",
  },
  create(context) {
    const nullMethods = new Set(["notEqual", "notStrictEqual"]);
    return {
      CallExpression(node) {
        if (
          node.callee.type !== "MemberExpression" ||
          node.callee.object.type !== "Identifier" ||
          node.callee.object.name !== "assert" ||
          node.callee.property.type !== "Identifier" ||
          !nullMethods.has(node.callee.property.name)
        ) {
          return;
        }

        if (
          node.arguments.some((argument) => argument.type === "Literal" && argument.value === null)
        ) {
          context.report({ node, messageId: "weak" });
        }
      },
    };
  },
};

const repositoryRules = {
  "non-null-only": nonNullOnlyRule,
  "strict-assert-import": strictAssertRule,
};

const blockingRules = [
  "no-assert-in-describe",
  "no-standalone-assert",
  "no-constant-assertion",
  "no-identical-assertion-arguments",
  "prefer-equality-assertion",
  "require-throws-expectation",
  "no-unawaited-promise-assertion",
  "no-unawaited-rejects",
  "no-only-test",
  "no-skip-without-reason",
  "no-commented-tests",
  "no-identical-title",
  "no-duplicate-assertions",
  "no-async-fn-without-await",
];

const warningRules = [
  "require-assertion",
  "no-useless-assertion",
  "no-conditional-assertion",
  "no-conditional-in-test",
  "no-sleep-in-test",
];

export default { rules: repositoryRules };

export const testQualityConfig = {
  plugins: [],
  categories: { correctness: "off" },
  jsPlugins: [
    { name: "lazuli-test", specifier: fileURLToPath(import.meta.url) },
    { name: "node-test", specifier: require.resolve("eslint-node-test") },
  ],
  rules: {
    ...Object.fromEntries(blockingRules.map((name) => [`node-test/${name}`, "error"])),
    ...Object.fromEntries(warningRules.map((name) => [`node-test/${name}`, "warn"])),
    "lazuli-test/non-null-only": "warn",
    "lazuli-test/strict-assert-import": "error",
  },
};
