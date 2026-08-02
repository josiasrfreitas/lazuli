import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/postcss";
import postcss from "postcss";

const repositoryRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const sharedUtilities = ["bg-primary", "text-3xl"];
const hostStyles = [
  { entry: "apps/web/src/app/globals.css", utility: "min-h-svh" },
  { entry: "apps/storybook/.storybook/globals.css", utility: "place-items-center" },
];

async function compileHostStyles(entry) {
  const entryPath = path.join(repositoryRoot, entry);
  const stylesheet = await readFile(entryPath, "utf8");
  const result = await postcss([tailwindcss()]).process(stylesheet, { from: entryPath });

  return result.css;
}

function assertUtility(stylesheet, utility) {
  assert.match(stylesheet, new RegExp(`\\.${utility}\\b`, "u"));
}

async function assertHostStyles({ entry, utility }) {
  const stylesheet = await compileHostStyles(entry);

  assert.doesNotMatch(stylesheet, /@(apply|custom-variant|import|source|theme)\\b/u);
  for (const sharedUtility of sharedUtilities) {
    assertUtility(stylesheet, sharedUtility);
  }
  assertUtility(stylesheet, utility);
}

async function assertHostEntrypointsAreImported() {
  const [layout, preview] = await Promise.all([
    readFile(path.join(repositoryRoot, "apps/web/src/app/layout.tsx"), "utf8"),
    readFile(path.join(repositoryRoot, "apps/storybook/.storybook/preview.tsx"), "utf8"),
  ]);

  assert.match(layout, /import "\.\/globals\.css";/u);
  assert.match(preview, /import "\.\/globals\.css";/u);
}

async function assertDarkDestructiveForeground() {
  const stylesPath = path.join(repositoryRoot, "packages/ui/src/styles/globals.css");
  const sharedStyles = await readFile(stylesPath, "utf8");
  const darkTheme = sharedStyles.slice(sharedStyles.indexOf(".dark {"));

  assert.match(darkTheme, /--destructive-foreground: oklch\(0\.18 0\.028 263\.7\);/u);
}

for (const hostStyle of hostStyles) {
  await assertHostStyles(hostStyle);
}
await assertHostEntrypointsAreImported();
await assertDarkDestructiveForeground();
