# Lazuli Frontend — Architecture & Constraints

**Status:** v1 — foundational contract for the `@lazuli/web` build.
**Scope:** How every Lazuli screen is built. This is the design-system + frontend-architecture decision that GRE-57 ("Triage: define design system") gated. Read this before opening any frontend issue.
**Companion docs:** [BUILD-PLAN.md](./BUILD-PLAN.md) (dependency-ordered work) · [../MVP/PRD.md](../MVP/PRD.md) · [../MVP/TECHNICAL_SPEC.md](../MVP/TECHNICAL_SPEC.md) · [../MVP/decisions.md](../MVP/decisions.md)

---

## 0. The one rule

**The frontend is a set of state machines. Rendering, deciding, and computing are three separate layers and never leak into each other.**

Everything below is the enforcement of that rule.

---

## 1. Three layers: Render / Decide / Compute

Every screen is split into three layers. A file belongs to exactly one.

| Layer                           | Answers                                                | Lives in                             | May **not**                                                                             |
| ------------------------------- | ------------------------------------------------------ | ------------------------------------ | --------------------------------------------------------------------------------------- |
| **Render** (components)         | "Given this state, what pixels?"                       | `components/*.tsx`                   | fetch data, call tRPC, derive business values, hold `useState` beyond local UI ephemera |
| **Decide** (page state machine) | "What state is this screen in, and what happens next?" | `machine.ts`                         | render JSX, run side effects inline (only via actors/actions)                           |
| **Compute** (logic engine)      | "Fetch it, derive it, format it."                      | `logic.ts`, `view-model.ts`, `lib/*` | render JSX, own screen state                                                            |

The dataflow is a loop, always in this order:

```
Component  --send(EVENT)-->  Machine  --invoke actor-->  Logic (tRPC / pure fns)
    ^                           |                              |
    |                           v                              v
    +------ renders from ---  state.context  <---- assign ---  result
```

**This is what "each page decides state, not the logic engine" means:** the machine owns the state decisions; the logic engine only fetches/derives/formats when the machine asks. A component can never accidentally hold logic because it has no way to run an effect — only the machine's actors can.

### Why XState v5

We use **XState v5** (`xstate` + `@xstate/react`) as the machine layer. Rationale, from evidence:

1. The product **is** a set of statecharts already — the prototype encodes them: installment lifecycle (`upcoming → current → overdue → paid | waived`), session/attendance (`futura → pendente → confirmada | cancelada`), enrollment transitions (transfer / advance / end), the new-student wizard (3 skippable steps), payment allocation, batch reconcile. Modeling these as anything other than machines invites boolean soup.
2. It **structurally enforces** the three-layer split: transitions live in the machine, side effects live in actors, JSX lives in components. There is no ergonomic way to violate the split, so review doesn't have to police it.
3. Machines are **headless-testable** — a page's decision logic is unit-tested with zero React.

### Machine tiers (apply pragmatically)

Not every screen needs a bespoke statechart. Pick the lightest tier that fits:

- **T0 — Static.** No async, no interaction → no machine. (Rare.)
- **T1 — Resource pages (list / detail).** Use the shared `createResourceMachine` factory: `idle → loading → (loaded | empty) → error`, with `REFETCH` / `RETRY`. Filtering/selection added as a parallel region. Covers most CRUD screens.
- **T2 — Flow machines (bespoke).** Hand-written statecharts for multi-step or multi-outcome flows: new-student wizard, register-payment allocation, batch reconcile, attendance confirm, transfer/advance/clone/cancel/waive.

---

## 2. Component rules (Render layer)

1. **≤ 200 lines per component file.** Hard limit, lint-enforced (`max-lines`, skip blanks + comments). Over the limit → extract subcomponents. This is a design constraint, not a formatting one: a 200-line component is doing too much.
2. **Pure and presentational.** Props in, events out (callbacks). No `@lazuli/api`/tRPC imports, no `fetch`, no business derivations. Enforced by ESLint import boundaries.
3. **Built on shadcn/ui + Tailwind + Lazuli tokens.** No ad-hoc hex values, no arbitrary spacing — only token classes (see §4).
4. **Storybook-first.** Every component ships a `*.stories.tsx`. The relevant **states are stories**: `Loading`, `Empty`, `Error`, `Filled`, `Selected`, mobile viewport, etc. If a state exists in the machine, it exists as a story.
5. **Local state only for ephemera** (input focus, hover, uncontrolled text before submit). Anything a refresh must survive, or that another part of the screen reads, belongs in the machine.

## 3. Logic-engine rules (Compute layer)

1. **All tRPC access is in `logic.ts`** as typed hooks/functions, invoked by the machine via `fromPromise` actors. Components and the machine config never import the tRPC client directly.
2. **Don't re-derive what the server derives.** Installment display status, balances, aging buckets, attendance % are computed server-side (GRE-45, GRE-63, GRE-64) — consume them. The client only does **view formatting**.
3. **Formatting is centralized** in `lib/format.ts`: BRL from integer cents (`123456 → "R$ 1.234,56"`, tabular-nums), dates and "today" logic in **`America/Sao_Paulo`**, phone → `wa.me/55…` deep links. One implementation, imported everywhere.
4. **View-models map API DTO → component props** in `view-model.ts` (pure functions), so components stay ignorant of API shapes.

## 4. Design system (`@lazuli/ui`)

The design system lives in `packages/ui` (the existing stub) and is consumed by `@lazuli/web`. It owns: tokens, the Tailwind preset, shadcn primitives, and Storybook.

- **Tokens** ported from the prototype's design bundle into CSS variables + a Tailwind preset: color primitives (`ink, slate, cloud, mist, azure, moss, ruby, gold`), surfaces (`page, card, sunken, navy, navy-active, overlay`), status pairs (`success/warning/danger/info` + `-bg`), borders, focus ring, shadows (`sm/md/lg`), typography (display serif + tabular sans for numeric data), motion keyframes. **Dark theme only** (`color-scheme: dark`) for MVP.
- **pt-BR is the product language.** All copy, validation messages, the 403/unauthorized text, empty states — Portuguese. Centralize reusable strings.
- **Accessibility floor:** attendance tap targets ≥ 44px (teacher wedge, S-ATT-1); keyboard/focus for admin tables and the ⌘K palette.

## 5. Folder structure

```
packages/ui/                         # DESIGN SYSTEM (Render primitives + tokens)
  src/tokens/{colors,typography,spacing,effects}.css
  src/tailwind-preset.ts
  src/components/{button,pill,table,modal,drawer,toast,command,...}.tsx   # each ≤200
  src/components/*.stories.tsx
  .storybook/

apps/web/src/
  app/(app)/alunos/page.tsx          # ROUTE — thin: renders <StudentsPage/>, sets metadata
  lib/
    trpc.ts                          # tRPC client (Compute boundary — the ONLY import site)
    format.ts                        # BRL / SP-timezone / wa.me formatters
    machine/createResourceMachine.ts # shared T1 factory
  features/
    students/
      machine.ts                     # DECIDE — XState machine (≤200; split actions/guards if needed)
      logic.ts                       # COMPUTE — tRPC hooks + pure helpers
      view-model.ts                  # COMPUTE — DTO → props
      StudentsPage.tsx               # wires machine ↔ components (thin; ≤200)
      components/                     # RENDER — StudentsTable, FilterChips, StudentDrawer... (each ≤200)
      components/*.stories.tsx
```

Routes under `app/` stay thin — they mount the feature's `*Page.tsx` and nothing else. Machines, logic, and components are colocated per feature so an issue touches one folder.

## 6. Enforcement (tooling)

These make the constraints mechanical, not aspirational:

- **`max-lines: 200`** on `**/*.tsx` under `apps/web/src/features` and `packages/ui/src/components` (extend `tooling/eslint`).
- **Import boundaries** (extend `tooling/eslint/boundaries.js`): `components/**` may not import `~/lib/trpc`, `@lazuli/api`, or a feature's `logic.ts`. `machine.ts` may not import React. Render can't reach into Compute except through props.
- **Storybook build in CI** + a coverage check that every exported component under `packages/ui/src/components` and `features/**/components` has a story.
- **jscpd** (already configured) guards against copy-paste instead of extraction.
- **Playwright** smoke per epic (harness already stubbed at `apps/web` `test:e2e`).

## 7. Definition of Done (every frontend issue)

An issue is done only when all hold:

- [ ] Components in the Render layer, each **≤ 200 lines**, pure (no tRPC/logic imports).
- [ ] A machine models **every** state including `loading` / `empty` / `error` plus the screen's domain states/transitions.
- [ ] tRPC calls isolated in `logic.ts`, invoked from machine actors — named procedures match the issue.
- [ ] **Storybook** stories cover each component and its key states.
- [ ] pt-BR copy · `America/Sao_Paulo` dates · BRL-from-cents formatting.
- [ ] Visual parity with the referenced prototype screen.
- [ ] `pnpm lint` (incl. max-lines + boundaries) · `typecheck` · Storybook build · e2e smoke all green.

---

## 8. Stack summary

| Concern               | Choice                                                       |
| --------------------- | ------------------------------------------------------------ |
| Framework             | Next.js 15 (App Router) · React 19 — existing `@lazuli/web`  |
| Styling               | Tailwind CSS + Lazuli token preset                           |
| Components            | shadcn/ui (Radix primitives), in `@lazuli/ui`                |
| State machines        | XState v5 + `@xstate/react`                                  |
| Data / logic          | `@trpc/react-query` + TanStack Query, isolated in `logic.ts` |
| Validation            | `zod` (reuse `@lazuli/validators`)                           |
| Component workshop    | Storybook 8                                                  |
| Testing               | Vitest (machines headless) · Playwright (e2e smoke)          |
| Language / TZ / money | pt-BR · America/Sao_Paulo · integer cents, BRL               |
