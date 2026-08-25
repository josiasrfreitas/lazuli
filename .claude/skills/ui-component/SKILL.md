---
name: ui-component
description: >-
  Pick the next UI Kit component from the Lazuli prototype inventory and
  implement it (component + Storybook story + ref type-test), coordinating
  with a second agent working on the same branch.
disable-model-invocation: true
---

# UI Component From Inventory

Short-lived workflow for building the design system one component at a time. Two agents always work on the same branch in parallel; the invocation arguments tell you (in bullet points) what the other agent is doing.

## Inputs

- **Inventory (source of truth for visual intent):** `/Users/josiasribeiro/orca/archived-contexts/lazuli/prototype-inventory/inventory.md`, with screenshots in the sibling `screenshots/` directory. Read the inventory first; open screenshots only when the written spec is ambiguous.
- **Invocation args:** bullets describing what the other agent on this branch is working on. If no args were given, ask before picking.

## Step 1 — Choose a component

1. Run `git status` and list `packages/ui/src/components/` to see what exists and what the other agent has in flight (untracked/modified files count as theirs).
2. From the inventory's recommended components, pick ONE that is not yet implemented and is **conceptually distant** from the other agent's component — different interaction model, no shared subcomponents, no shared new tokens. Example: if they're on `Select`, don't pick `Combobox` or `SelectField`; pick `Checkbox`, `Tabs`, `Dialog`, `Table`, etc.
3. Never edit or rename files the other agent created or touched. The only shared file you may touch is `packages/ui/src/index.ts` (see Step 4).
4. State your pick and the reasoning in one short paragraph before writing code.

## Step 2 — Implement in `packages/ui`

Follow the existing components (`button.tsx`, `input.tsx`, `badge.tsx`, `alert.tsx`) as the convention reference — read at least two of them before writing:

- **Primitives:** `@base-ui/react` (NOT Radix). shadcn is design reference only; adapt its anatomy to Base UI. Simple elements use `useRender` + `mergeProps` (see `badge.tsx`) so consumers can swap the rendered tag.
- **Composition points are unstyled.** Base UI's `render` prop merges props and CONCATENATES classNames (no tailwind-merge), so any part consumers compose via `render` — Trigger, Close, anything that will receive a `<Button/>` or `<Input/>` — must be a bare passthrough (just `data-slot` + ref). Styled decorations (corner X, chevron) live INSIDE the parent behind a prop (see `dialog.tsx`: `DialogContent` renders its own close button via `showCloseButton`, while `DialogClose` is unstyled). Corollary: if a container reserves space for a child (e.g. `pr-12` for an absolute X), that same component must render the child — never leave a positioning contract implicit for consumers.
- **Styling:** `cva` for variants, `cn` from `../lib/utils`, semantic tokens only (`bg-muted`, `border-input`, `text-control`, `h-control-md`, `shadow-focus`, `duration-fast`, `ease-standard`, `opacity-disabled`, …). Read `packages/ui/src/styles/globals.css` for the available tokens; if a needed role is missing, add a semantic token there — never hardcode hex values from the prototype.
- **Custom `@utility` rule:** only add a utility to `packages/ui/src/styles/tokens/tailwind-bridge.css` when it (a) consumes a design token AND (b) is used by 2+ components. Otherwise keep the classes inline in the single consumer — every utility grows the shadow API consumers must learn.
- **Intent, not mimicry:** the prototype is dark-only evidence; express its character (calm, dense, quiet hierarchy, contrast-driven primary) through semantic roles so both themes work. Don't preserve documented prototype inconsistencies (font leaks, density drift, missing focus rings).
- **Accessibility:** real semantics (roles, labels, `aria-invalid`/`aria-disabled`), visible `focus-visible` ring via `shadow-focus`, never color-only status.
- **Conventions:** kebab-case filename in `packages/ui/src/components/`, `data-slot` attribute, exported prop types (`XxxProps`, `XxxVariant`), JSDoc on non-obvious props, function components returning `ReactElement`.
- **Type-test:** add `packages/ui/test/<name>-ref.type-test.tsx` following `input-ref.type-test.tsx` — ref forwarding, the public contract, and at least one `@ts-expect-error` for a misuse.

## Step 3 — Storybook story

Create `apps/storybook/src/components/<name>.stories.tsx` following `input.stories.tsx`:

- `Meta` with `title: "Components/<Name>"`, `tags: ["autodocs"]`, a one-sentence `docs.description.component`.
- Stories: `Playground` (with a `play` interaction test via `storybook/test`), one story per axis (variants/sizes), and a `States` story (including invalid/disabled where applicable). Do not add a `Themes` story — dark mode is checked with the theme switcher in the Storybook toolbar, which also covers portaled content.
- Cover the states the inventory's "Minimal Storybook validation matrix" lists for the component, even states the prototype omitted.

## Step 4 — Export and verify

1. Append the component's exports to `packages/ui/src/index.ts` as a self-contained block at the end of the export list. Keep the edit minimal and don't reorder existing exports — the other agent edits this file too.
2. Run `pnpm typecheck` and `pnpm lint` in `packages/ui` and in `apps/storybook`; fix everything.
3. **Visual gate (mandatory before reporting done)** — typecheck, lint, and play tests are all blind to layout; a visually broken component passes every one of them:
   1. Check Storybook is up (`curl -sf http://localhost:6006` — the two agents share one instance); if not, start it in the background with `pnpm storybook` from the repo root.
   2. For EVERY story of your component, open `http://localhost:6006/iframe.html?id=components-<name>--<story-kebab>` with the chrome-devtools MCP tools and take a screenshot.
   3. Inspect each screenshot yourself: layout intact, nothing overlapping or overflowing, controls where a user expects them. Screenshot at least one story with the toolbar theme set to dark. Fix and re-screenshot until every story is clean.
4. Do not commit — the user coordinates commits between the two agents.
5. Finish by reporting: component chosen, files created, states covered, any token you added to `globals.css`, and confirmation that the visual gate passed for every story.
