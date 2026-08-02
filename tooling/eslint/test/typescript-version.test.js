import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { it } from "node:test";

const require = createRequire(import.meta.url);
const typescriptPackage = require("typescript/package.json");

it("uses the isolated TypeScript 6 ESLint dependency", () => {
  assert.equal(typescriptPackage.name, "@typescript/typescript6");
  assert.match(typescriptPackage.version, /^6\.\d+\.\d+$/u);
});
