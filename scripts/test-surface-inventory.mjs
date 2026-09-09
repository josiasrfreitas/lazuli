import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { appRouter } from "../packages/api/src/root.ts";
import * as jobContracts from "../packages/job-contracts/src/index.ts";

const procedures = collectProcedures(appRouter._def.record);
const workflows = Object.entries(jobContracts)
  .filter(([name, value]) => name.endsWith("_WORKFLOW") && typeof value === "string")
  .map(([, value]) => value)
  .toSorted();
const testText = collectTestText();

process.stdout.write(
  "Surface inventory (name references only; this is not proof of execution):\nProcedures:\n",
);
printReferences(procedures, testText);
process.stdout.write("Workflows:\n");
printReferences(workflows, testText);

function collectProcedures(record, prefix = "") {
  return Object.entries(record).flatMap(([name, value]) => {
    const qualified = prefix ? `${prefix}.${name}` : name;
    if (value?._def?.procedure) return [qualified];
    if (value?._def?.record) return collectProcedures(value._def.record, qualified);
    if (value && typeof value === "object") return collectProcedures(value, qualified);
    return [];
  });
}

function collectTestText() {
  const chunks = [];
  for (const root of ["apps", "packages"]) {
    for (const workspace of readdirSync(root, { withFileTypes: true })) {
      const testDirectory = path.join(root, workspace.name, "test");
      if (!workspace.isDirectory()) continue;
      try {
        for (const entry of readdirSync(testDirectory, { recursive: true, withFileTypes: true })) {
          if (entry.isFile() && /\.test\.[jt]sx?$/u.test(entry.name)) {
            chunks.push(readFileSync(path.join(entry.parentPath, entry.name), "utf8"));
          }
        }
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
  }
  return chunks.join("\n");
}

function printReferences(names, contents) {
  for (const name of names) {
    process.stdout.write(`  ${contents.includes(name) ? "referenced" : "unreferenced"}  ${name}\n`);
  }
}
