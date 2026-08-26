import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

export async function assertComponentContracts(repositoryRoot) {
  const sources = await readComponentSources(repositoryRoot);

  assertButtonContract(sources);
  assertInputContract(sources);
  assertBadgeContract(sources);
  assertAlertContract(sources);
  assertDialogContract(sources);
  assertSelectContract(sources);
  assertTextareaScrollbarContract(sources);
  assertPopoverContract(sources);
  assertTabsContract(sources);
  assertTableContract(sources);
  assertTableSkeletonContract(sources);
  assertTableStoryContract(sources);
}

const componentSourcePaths = {
  alertSource: "packages/ui/src/components/alert.tsx",
  badgeSource: "packages/ui/src/components/badge.tsx",
  buttonSource: "packages/ui/src/components/button.tsx",
  buttonStory: "apps/storybook/src/components/button.stories.tsx",
  dialogLayoutSource: "packages/ui/src/components/dialog-layout.tsx",
  dialogSource: "packages/ui/src/components/dialog.tsx",
  dialogStory: "apps/storybook/src/components/dialog.stories.tsx",
  inputSource: "packages/ui/src/components/input.tsx",
  inputStory: "apps/storybook/src/components/input.stories.tsx",
  popoverSource: "packages/ui/src/components/popover.tsx",
  popoverStory: "apps/storybook/src/components/popover.stories.tsx",
  selectContentSource: "packages/ui/src/components/select-content.tsx",
  selectOptionsSource: "packages/ui/src/components/select-options.tsx",
  selectSource: "packages/ui/src/components/select.tsx",
  tableCellsSource: "packages/ui/src/components/table-cells.tsx",
  tableSource: "packages/ui/src/components/table.tsx",
  tableSkeletonSource: "packages/ui/src/components/table-skeleton.tsx",
  tableStory: "apps/storybook/src/components/table.stories.tsx",
  tabsSource: "packages/ui/src/components/tabs.tsx",
  tabsStory: "apps/storybook/src/components/tabs.stories.tsx",
  textareaSource: "packages/ui/src/components/textarea.tsx",
};

async function readComponentSources(repositoryRoot) {
  const entries = await Promise.all(
    Object.entries(componentSourcePaths).map(async ([key, relativePath]) => [
      key,
      await readFile(path.join(repositoryRoot, relativePath), "utf8"),
    ]),
  );

  return Object.fromEntries(entries);
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
  for (const story of ["Playground", "Types", "States"]) {
    assert.match(inputStory, new RegExp(`export const ${story}:`, "u"));
  }
}

function assertBadgeContract({ badgeSource }) {
  assert.match(badgeSource, /@base-ui\/react\/merge-props/u);
  assert.match(badgeSource, /@base-ui\/react\/use-render/u);
}

function assertDialogContract({ dialogLayoutSource, dialogSource, dialogStory }) {
  assert.match(dialogSource, /@base-ui\/react\/dialog/u);
  assert.match(dialogSource, /showCloseButton = true/u);
  assert.match(dialogSource, /data-slot="dialog-content"/u);
  // The corner "X" lives in dialog-layout so dialog and sheet share it.
  assert.match(dialogLayoutSource, /data-slot="dialog-close-button"/u);
  assert.match(dialogLayoutSource, /absolute right-4 top-4/u);
  // DialogHeader's pr-8 reserves space for the close X (`right-4` + `size-8`)
  // rendered by DialogContent — the pair must change together.
  assert.match(dialogLayoutSource, /pr-8/u);
  assert.match(dialogLayoutSource, /data-slot="dialog-body"/u);
  assert.match(dialogLayoutSource, /scrollbar-subtle/u);
  // DialogClose is a composition point (`render={<Button/>}` concatenates
  // classNames), so it must stay an unstyled passthrough.
  const dialogCloseSource = dialogSource.slice(dialogSource.indexOf("export const DialogClose"));
  assert.match(dialogCloseSource, /data-slot="dialog-close"/u);
  assert.doesNotMatch(dialogCloseSource, /size-8|inline-flex/u);
  assert.match(dialogStory, /title: "Components\/Dialog"/u);
  assert.match(dialogStory, /tags: \["autodocs"\]/u);
  assert.match(dialogStory, /from "storybook\/test"/u);
  for (const story of ["Playground", "States", "LongContent"]) {
    assert.match(dialogStory, new RegExp(`export const ${story}:`, "u"));
  }
}

function assertSelectContract({ selectSource, selectContentSource, selectOptionsSource }) {
  assert.match(selectSource, /@base-ui\/react\/select/u);
  // The trigger styles child slots via arbitrary selectors; keep each
  // selector paired with the slot definition in the same file so a slot
  // rename cannot silently detach them.
  assert.match(selectSource, /\[&_\[data-slot=select-value\]\]/u);
  assert.match(selectSource, /data-slot="select-value"/u);
  assert.match(selectSource, /\[&_\[data-slot=select-icon\]\]/u);
  assert.match(selectSource, /data-slot="select-icon"/u);
  assert.match(selectSource, /data-slot="select-trigger"/u);
  assert.match(selectContentSource, /data-slot="select-content"/u);
  assert.match(selectContentSource, /scrollbar-subtle/u);
  for (const slot of [
    "select-item",
    "select-item-text",
    "select-item-indicator",
    "select-separator",
  ]) {
    assert.match(selectOptionsSource, new RegExp(`data-slot="${slot}"`, "u"));
  }
}

function assertTextareaScrollbarContract({ textareaSource }) {
  assert.match(textareaSource, /scrollbar-subtle/u);
}

function assertPopoverContract({ popoverSource, popoverStory }) {
  assert.match(popoverSource, /@base-ui\/react\/popover/u);
  assert.match(popoverSource, /data-slot="popover-content"/u);
  // The tail is nested inside the popup so it inherits the panel's transform;
  // `-z-10` only slips it under the panel because the positioner owns `z-50`.
  assert.match(popoverSource, /data-slot="popover-arrow"/u);
  assert.match(popoverSource, /-z-10/u);
  assert.match(popoverSource, /data-slot="popover-positioner"[\s\S]*?>/u);
  assert.match(popoverSource, /className="z-50"/u);
  // Trigger and Close are composition points (`render={<Button/>}` concatenates
  // classNames), so both must stay unstyled passthroughs.
  for (const part of ["PopoverTriggerImpl", "PopoverClose"]) {
    const partSource = popoverSource.slice(popoverSource.indexOf(`const ${part}`));
    assert.match(partSource, /className=\{cn\(className\)\}/u);
  }
  assert.match(popoverStory, /title: "Components\/Popover"/u);
  assert.match(popoverStory, /tags: \["autodocs"\]/u);
  assert.match(popoverStory, /from "storybook\/test"/u);
  for (const story of ["Playground", "Sizes", "Positions", "States"]) {
    assert.match(popoverStory, new RegExp(`export const ${story}:`, "u"));
  }
}

function assertTabsContract({ tabsSource, tabsStory }) {
  assert.match(tabsSource, /@base-ui\/react\/tabs/u);
  for (const slot of ["tabs", "tabs-list", "tabs-tab", "tabs-indicator", "tabs-panel"]) {
    assert.match(tabsSource, new RegExp(`data-slot="${slot}"`, "u"));
  }
  // The indicator is painted behind the tabs so an active label keeps its own
  // color; the pair of z-indexes must move together.
  assert.match(tabsSource, /"absolute[^"]*\bz-0\b/u);
  assert.match(tabsSource, /"relative[^"]*\bz-10\b/u);
  // The indicator tracks the active tab through Base UI's coordinate vars.
  assert.match(tabsSource, /--active-tab-left/u);
  assert.match(tabsSource, /--active-tab-width/u);
  assert.match(tabsSource, /motion-reduce:transition-none/u);
  assert.match(tabsStory, /title: "Components\/Tabs"/u);
  assert.match(tabsStory, /tags: \["autodocs"\]/u);
  assert.match(tabsStory, /from "storybook\/test"/u);
  for (const story of ["Playground", "Variants", "Sizes", "States"]) {
    assert.match(tabsStory, new RegExp(`export const ${story}:`, "u"));
  }
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

function assertTableContract({ tableSource, tableCellsSource }) {
  // Tabular data uses real table markup; the prototype's CSS grids are not a
  // model for the accessible implementation.
  for (const tag of ["<table", "<thead", "<tbody", "<tfoot", "<caption", "<tr", "<th", "<td"]) {
    assert.match(tableSource + tableCellsSource, new RegExp(tag, "u"));
  }
  for (const slot of ["table-container", "table", "table-header", "table-body", "table-row"]) {
    assert.match(tableSource, new RegExp(`data-slot="${slot}"`, "u"));
  }
  for (const slot of ["table-head", "table-cell", "table-empty"]) {
    assert.match(tableCellsSource, new RegExp(`data-slot="${slot}"`, "u"));
  }
  // The container owns the horizontal scroll so a wide table never widens the
  // page; the two densities are the only sanctioned row heights.
  assert.match(tableSource, /overflow-x-auto[\s\S]*?scrollbar-subtle/u);
  // The container scrolls only because the table keeps a minimum width;
  // the pair must move together or narrow viewports crush the columns.
  assert.match(tableSource, /min-w-lg/u);
  assert.match(tableSource, /compact:\s*"h-10/u);
  assert.match(tableSource, /default:\s*"h-12/u);
  // Selection state is exposed to assistive technology, never by colour alone.
  assert.match(tableSource, /aria-selected=\{selected \|\| undefined\}/u);
  assert.match(tableSource, /data-selected=\{selected \|\| undefined\}/u);
  // A sortable header renders its own button and icon, so the control cannot
  // drift away from the `aria-sort` it announces.
  assert.match(
    tableCellsSource,
    /aria-sort=\{onSort \? \(sortDirection \?\? "none"\) : undefined\}/u,
  );
  assert.match(tableCellsSource, /data-slot="table-sort-button"/u);
  assert.match(tableCellsSource, /data-slot="table-sort-icon"/u);
  // Currency and counts are right-aligned and tabular in the body.
  assert.match(tableCellsSource, /numeric &&[^"]*"text-right[^"]*\btabular-nums\b/u);
}

function assertTableSkeletonContract({ tableSkeletonSource }) {
  // Loading draws real rows and cells so the columns keep their widths; a
  // centred message here would resize the table when the data lands.
  for (const slot of ["table-skeleton-row", "table-skeleton-cell", "table-skeleton-bar"]) {
    assert.match(tableSkeletonSource, new RegExp(`data-slot="${slot}"`, "u"));
  }
  assert.match(tableSkeletonSource, /animate-pulse motion-reduce:animate-none/u);
  // The bars are decorative; the sr-only status row is what gets announced.
  assert.match(tableSkeletonSource, /aria-hidden="true"/u);
  assert.match(tableSkeletonSource, /role="status"/u);
}

function assertTableStoryContract({ tableStory }) {
  assert.match(tableStory, /title: "Components\/Table"/u);
  assert.match(tableStory, /tags: \["autodocs"\]/u);
  assert.match(tableStory, /from "storybook\/test"/u);
  for (const story of [
    "Playground",
    "Densities",
    "Sorting",
    "Selection",
    "Totals",
    "Loading",
    "States",
  ]) {
    assert.match(tableStory, new RegExp(`export const ${story}:`, "u"));
  }
}
