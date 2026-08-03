import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/postcss";
import postcss from "postcss";

import { assertContrast, getBlock, getDeclarations, resolveColor } from "./style-test-utils.mjs";

const repositoryRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const colorTokenPath = "packages/ui/src/styles/tokens/color.css";
const typographyTokenPath = "packages/ui/src/styles/tokens/typography.css";
const scaleTokenPath = "packages/ui/src/styles/tokens/scale.css";
const effectsTokenPath = "packages/ui/src/styles/tokens/effects.css";
const tailwindBridgePath = "packages/ui/src/styles/tokens/tailwind-bridge.css";
const tokensStoryPath = "apps/storybook/src/tokens.stories.tsx";
const normalTextContrastMinimum = 4.5;
const nonTextContrastMinimum = 3;
const poppinsWeights = ["500", "600", "700"];
const semanticColorRoles = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "destructive-foreground",
  "border",
  "border-strong",
  "input",
  "ring",
  "brand",
  "brand-foreground",
  "interactive",
  "success",
  "success-muted",
  "warning",
  "warning-muted",
  "info",
  "info-muted",
  "destructive-muted",
  "overlay",
];
const colorUtilities = [
  "bg-primary",
  "text-primary-foreground",
  "bg-brand",
  "text-brand-foreground",
  "text-interactive",
  "text-success",
  "bg-success-muted",
];
const typographyUtilities = [
  "font-sans",
  "font-display",
  "text-display",
  "text-h1",
  "text-h2",
  "text-h3",
  "text-body",
  "text-control",
  "text-caption",
  "text-micro",
  "tracking-label",
];
const scaleAndEffectsUtilities = [
  "p-4",
  "h-control-sm",
  "h-control-md",
  "h-control-lg",
  "rounded-sm",
  "rounded-md",
  "rounded-lg",
  "rounded-xl",
  "rounded-full",
  "shadow-sm",
  "shadow-md",
  "shadow-lg",
  "shadow-focus",
  "ease-standard",
  "duration-fast",
  "duration-base",
  "duration-slow",
];
const sharedUtilities = [...colorUtilities, ...typographyUtilities, ...scaleAndEffectsUtilities];
const hostStyles = [
  { entry: "apps/web/src/app/globals.css", utility: "min-h-svh" },
  { entry: "apps/storybook/.storybook/globals.css", utility: "place-items-center" },
];

function assertUtility(stylesheet, utility) {
  assert.match(stylesheet, new RegExp(`\\.${utility}\\b`, "u"));
}

async function compileHostStyles(entry) {
  const entryPath = path.join(repositoryRoot, entry);
  const stylesheet = await readFile(entryPath, "utf8");
  const testSource = `\n@source inline("${sharedUtilities.join(" ")}");\n`;
  const result = await postcss([tailwindcss()]).process(`${stylesheet}${testSource}`, {
    from: entryPath,
  });

  return result.css;
}

async function assertHostStyles({ entry, utility }) {
  const stylesheet = await compileHostStyles(entry);

  assert.doesNotMatch(stylesheet, /@(apply|custom-variant|import|source|theme)\b/u);
  for (const utility of sharedUtilities) {
    assertUtility(stylesheet, utility);
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

const [
  colorTokens,
  typographyTokens,
  scaleTokens,
  effectsTokens,
  tailwindBridge,
  globalStyles,
  storybookMain,
  storybookPreview,
  tokensStory,
] = await Promise.all([
  readFile(path.join(repositoryRoot, colorTokenPath), "utf8"),
  readFile(path.join(repositoryRoot, typographyTokenPath), "utf8"),
  readFile(path.join(repositoryRoot, scaleTokenPath), "utf8"),
  readFile(path.join(repositoryRoot, effectsTokenPath), "utf8"),
  readFile(path.join(repositoryRoot, tailwindBridgePath), "utf8"),
  readFile(path.join(repositoryRoot, "packages/ui/src/styles/globals.css"), "utf8"),
  readFile(path.join(repositoryRoot, "apps/storybook/.storybook/main.ts"), "utf8"),
  readFile(path.join(repositoryRoot, "apps/storybook/.storybook/preview.tsx"), "utf8"),
  readFile(path.join(repositoryRoot, tokensStoryPath), "utf8"),
]);
const lightTokens = getDeclarations(colorTokens, ":root,\n.light");
const darkTokens = getDeclarations(colorTokens, ".dark");

assert.match(getBlock(colorTokens, ":root,\n.light"), /color-scheme: light;/u);
assert.match(getBlock(colorTokens, ".dark"), /color-scheme: dark;/u);
for (const role of semanticColorRoles) {
  assert.ok(lightTokens.has(`--${role}`), `Missing light --${role} token.`);
  assert.ok(darkTokens.has(`--${role}`), `Missing dark --${role} token.`);
  assert.match(tailwindBridge, new RegExp(`--color-${role}: var\\(--${role}\\);`, "u"));
}
assert.match(colorTokens, /--lz-ref-/u);
assert.doesNotMatch(tailwindBridge, /--color-lz-ref-/u);

for (const [theme, tokens, expected] of [
  [
    "light",
    lightTokens,
    {
      background: "#f4f6fb",
      foreground: "#0f1e3d",
      primary: "#142a5f",
      interactive: "#3b5bc4",
      ring: "#3b5bc4",
      brand: "#d8ad4a",
      destructive: "#b3283f",
    },
  ],
  [
    "dark",
    darkTokens,
    {
      background: "#0a0c12",
      foreground: "#e9edf6",
      primary: "#e9edf6",
      interactive: "#5c7ce6",
      ring: "#6c8cf0",
      brand: "#d8ad4a",
      destructive: "#e0637a",
    },
  ],
]) {
  for (const [token, color] of Object.entries(expected)) {
    assert.equal(resolveColor(tokens, token), color, `Unexpected ${theme} ${token} token.`);
  }

  for (const [foreground, background] of [
    ["foreground", "background"],
    ["card-foreground", "card"],
    ["popover-foreground", "popover"],
    ["primary-foreground", "primary"],
    ["secondary-foreground", "secondary"],
    ["muted-foreground", "muted"],
    ["accent-foreground", "accent"],
    ["destructive-foreground", "destructive"],
    ["brand-foreground", "brand"],
    ["interactive", "background"],
    ["success", "success-muted"],
    ["warning", "warning-muted"],
    ["info", "info-muted"],
    ["destructive", "destructive-muted"],
  ]) {
    assertContrast(tokens, { foreground, background, minimum: normalTextContrastMinimum });
  }
  assertContrast(tokens, {
    foreground: "ring",
    background: "background",
    minimum: nonTextContrastMinimum,
  });
}

assert.match(
  typographyTokens,
  /url\("@fontsource-variable\/inter\/files\/inter-latin-wght-normal\.woff2"\)/u,
);
for (const weight of poppinsWeights) {
  assert.match(
    globalStyles,
    new RegExp(`@import "@fontsource/poppins/latin-${weight}\\.css";`, "u"),
  );
}
for (const token of [
  "font-sans",
  "font-display",
  "text-display",
  "text-h1",
  "text-h2",
  "text-h3",
  "text-body",
  "text-control",
  "text-caption",
  "text-micro",
  "tracking-label",
]) {
  assert.match(typographyTokens, new RegExp(`--lz-${token}:`, "u"));
  assert.match(tailwindBridge, new RegExp(`--${token}: var\\(--lz-${token}\\);`, "u"));
}
for (const token of ["display", "h1", "h2", "h3", "body", "control", "caption", "micro"]) {
  assert.match(
    tailwindBridge,
    new RegExp(`--text-${token}--line-height: var\\(--lz-leading-${token}\\);`, "u"),
  );
}

assert.match(scaleTokens, /--lz-space-unit: 0\.25rem;/u);
assert.match(tailwindBridge, /--spacing: var\(--lz-space-unit\);/u);
for (const size of ["sm", "md", "lg"]) {
  assert.match(scaleTokens, new RegExp(`--lz-control-${size}:`, "u"));
  assert.match(
    tailwindBridge,
    new RegExp(`--spacing-control-${size}: var\\(--lz-control-${size}\\);`, "u"),
  );
}
for (const radius of ["sm", "md", "lg", "xl", "full"]) {
  assert.match(scaleTokens, new RegExp(`--lz-radius-${radius}:`, "u"));
  assert.match(
    tailwindBridge,
    new RegExp(`--radius-${radius}: var\\(--lz-radius-${radius}\\);`, "u"),
  );
}
const rootEffects = getDeclarations(effectsTokens, ":root");
const darkEffects = getDeclarations(effectsTokens, ".dark");
for (const shadow of ["sm", "md", "lg", "focus"]) {
  assert.ok(rootEffects.has(`--lz-shadow-${shadow}`), `Missing light ${shadow} shadow.`);
  assert.ok(darkEffects.has(`--lz-shadow-${shadow}`), `Missing dark ${shadow} shadow.`);
  assert.match(
    tailwindBridge,
    new RegExp(`--shadow-${shadow}: var\\(--lz-shadow-${shadow}\\);`, "u"),
  );
}
assert.match(effectsTokens, /--lz-shadow-focus: 0 0 0 3px /u);
assert.match(tailwindBridge, /--ease-standard: var\(--lz-ease-standard\);/u);
for (const duration of ["fast", "base", "slow"]) {
  assert.match(effectsTokens, new RegExp(`--lz-duration-${duration}:`, "u"));
  assert.match(
    tailwindBridge,
    new RegExp(`--duration-${duration}: var\\(--lz-duration-${duration}\\);`, "u"),
  );
}

assert.match(storybookMain, /"@storybook\/addon-a11y"/u);
assert.match(storybookPreview, /theme:/u);
assert.match(storybookPreview, /defaultValue: "light"/u);
assert.match(storybookPreview, /globals\.theme === "dark"/u);
assert.match(tokensStory, /title: "Foundation\/Tokens"/u);
for (const story of ["Colors", "Typography", "ScaleAndEffects"]) {
  assert.match(tokensStory, new RegExp(`export const ${story}:`, "u"));
}
assert.match(tokensStory, /Educa[çc][ãa]o/u);

for (const hostStyle of hostStyles) {
  await assertHostStyles(hostStyle);
}
await assertHostEntrypointsAreImported();
