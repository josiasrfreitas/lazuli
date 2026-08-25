import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const componentRoots = ["packages/ui/src/components", "apps/web/src"];
const maximumLines = 200;

async function findComponents(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);

      if (entry.isDirectory()) return findComponents(entryPath);
      if (!entry.name.endsWith(".tsx") || entry.name.includes(".stories.")) return [];

      return [entryPath];
    }),
  );

  return files.flat();
}

for (const componentRoot of componentRoots) {
  const absoluteRoot = path.join(repositoryRoot, componentRoot);
  const componentPaths = await findComponents(absoluteRoot);

  for (const componentPath of componentPaths) {
    const source = await readFile(componentPath, "utf8");
    const lineCount = source.split(/\r?\n/u).length;
    const relativePath = path.relative(repositoryRoot, componentPath);

    assert.ok(
      lineCount <= maximumLines,
      `${relativePath} has ${lineCount} lines; component files are limited to ${maximumLines}.`,
    );
  }
}
