import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

export async function assertComponentContracts(repositoryRoot) {
  const sources = await readComponentSources(repositoryRoot);

  assertButtonContract(sources);
  assertInputContract(sources);
  assertBadgeContract(sources);
  assertAlertContract(sources);
}

async function readComponentSources(repositoryRoot) {
  const [buttonSource, buttonStory, inputSource, inputStory, badgeSource, alertSource] =
    await Promise.all([
      readFile(path.join(repositoryRoot, "packages/ui/src/components/button.tsx"), "utf8"),
      readFile(
        path.join(repositoryRoot, "apps/storybook/src/components/button.stories.tsx"),
        "utf8",
      ),
      readFile(path.join(repositoryRoot, "packages/ui/src/components/input.tsx"), "utf8"),
      readFile(
        path.join(repositoryRoot, "apps/storybook/src/components/input.stories.tsx"),
        "utf8",
      ),
      readFile(path.join(repositoryRoot, "packages/ui/src/components/badge.tsx"), "utf8"),
      readFile(path.join(repositoryRoot, "packages/ui/src/components/alert.tsx"), "utf8"),
    ]);

  return { alertSource, badgeSource, buttonSource, buttonStory, inputSource, inputStory };
}

function assertButtonContract({ buttonSource, buttonStory }) {
  for (const variant of ["primary", "secondary", "ghost", "destructive", "link"]) {
    assert.match(buttonSource, new RegExp(`${variant}:`, "u"));
  }
  assert.match(buttonSource, /secondary:[\s\S]*?hover:bg-accent-hover/u);
  for (const size of ["sm", "md", "lg", "icon-sm", "icon-md", "icon-lg"]) {
    assert.match(buttonSource, new RegExp(`(?:"${size}"|${size}):`, "u"));
  }
  assert.match(buttonSource, /aria-busy=\{loading \|\| undefined\}/u);
  assert.match(buttonSource, /disabled=\{disabled \|\| loading\}/u);
  assert.match(buttonSource, /type = "button"/u);
  assert.match(buttonSource, /@base-ui\/react\/button/u);
  assert.match(buttonStory, /title: "Components\/Button"/u);
  assert.match(buttonStory, /tags: \["autodocs"\]/u);
  assert.match(buttonStory, /from "storybook\/test"/u);
  for (const story of ["Playground", "Variants", "Sizes", "WithIcons", "IconOnly", "States"]) {
    assert.match(buttonStory, new RegExp(`export const ${story}:`, "u"));
  }
}

function assertInputContract({ inputSource, inputStory }) {
  assert.match(inputSource, /aria-invalid=\{invalid \|\| undefined\}/u);
  assert.match(inputSource, /data-invalid=\{invalid \|\| undefined\}/u);
  assert.match(inputSource, /@base-ui\/react\/input/u);
  for (const state of [
    "focus-visible:border-ring",
    "focus-visible:shadow-focus",
    "aria-invalid:border-destructive",
    "disabled:opacity-disabled",
    "read-only:bg-muted",
  ]) {
    assert.match(inputSource, new RegExp(state, "u"));
  }
  assert.match(inputStory, /title: "Components\/Input"/u);
  assert.match(inputStory, /tags: \["autodocs"\]/u);
  assert.match(inputStory, /from "storybook\/test"/u);
  for (const story of ["Playground", "Types", "States", "Themes"]) {
    assert.match(inputStory, new RegExp(`export const ${story}:`, "u"));
  }
}

function assertBadgeContract({ badgeSource }) {
  assert.match(badgeSource, /@base-ui\/react\/merge-props/u);
  assert.match(badgeSource, /@base-ui\/react\/use-render/u);
}

function assertAlertContract({ alertSource }) {
  assert.match(alertSource, /group\/alert/u);
  assert.match(alertSource, /has-data-\[slot=alert-action\]:pr-18/u);
  for (const slot of [
    "alert",
    "alert-icon",
    "alert-content",
    "alert-title",
    "alert-description",
    "alert-action",
  ]) {
    assert.match(alertSource, new RegExp(`data-slot="${slot}"`, "u"));
  }
}
