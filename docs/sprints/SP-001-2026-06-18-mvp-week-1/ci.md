# Minimum CI Triggers

Derived from [TECHNICAL_SPEC §10.2](../../MVP/TECHNICAL_SPEC.md#102-commands) (quality gates) and
[§3.4](../../MVP/TECHNICAL_SPEC.md#34-code-quality-guardrails) (guardrails). This defines the **minimum**
automated checks the sprint commits to. The CI provider is not locked (host decision is open —
[§11](../../MVP/TECHNICAL_SPEC.md#11-deployment-and-infra)); the trigger matrix below is provider-agnostic.
GitHub Actions is the concrete starting point because the repo will live on GitHub.

> Spec position: _"When CI is selected, it should run lint, typecheck, unit tests, and DB integration
> tests against Postgres 16. E2E can start as manual or nightly until the app stabilizes."_

## Trigger matrix

| Check                | Command                                            | PR → main | Push → main | Nightly | Manual |
| -------------------- | -------------------------------------------------- | :-------: | :---------: | :-----: | :----: |
| Install + cache      | `pnpm install --frozen-lockfile`                   |    ✅     |     ✅      |   ✅    |   ✅   |
| Format               | `pnpm format:check` (prettier `--check`)           |    ✅     |     ✅      |    —    |   —    |
| Lint                 | `pnpm lint` (ESLint, incl. boundary rules)         |    ✅     |     ✅      |    —    |   —    |
| Typecheck            | `pnpm typecheck` (`tsc --noEmit`, strict)          |    ✅     |     ✅      |    —    |   —    |
| Unit tests           | `pnpm test` (domain calculators)                   |    ✅     |     ✅      |    —    |   —    |
| DB integration       | `pnpm test:db` against **Postgres 16**             |    ✅     |     ✅      |    —    |   —    |
| Prisma migrate check | `pnpm prisma:deploy` + `pnpm prisma:drift` on PG16 |    ✅     |     ✅      |    —    |   —    |
| Build                | `pnpm build` (turbo)                               |    ✅     |     ✅      |    —    |   —    |
| E2E smoke            | `pnpm test:e2e` (Playwright)                       |     —     |      —      |   ✅    |   ✅   |

Legend: ✅ blocking gate · — not run on that trigger.

## Required setup

- **Postgres 16 service** for `test:db` and the migrate/drift check (matches prod; Cloud SQL PG16).
  The same image as Docker Compose ([§2.2](../../MVP/TECHNICAL_SPEC.md#22-runtime-topology)).
- **Turborepo remote/loca cache** so unchanged packages skip rework.
- **Node + pnpm** pinned to the repo's package-manager version (T3 Turbo defaults).
- `test:e2e` is **not** a PR gate while the app stabilizes; it runs nightly and on-demand
  (the worker image is Playwright-capable — keep E2E off the hot path).

## What CI does NOT do in MVP

- No deploy step until the web-host / Cloud SQL connectivity decision closes ([§11](../../MVP/TECHNICAL_SPEC.md#11-deployment-and-infra)).
- No Sentry/observability upload (no Sentry in MVP).
- No coverage gate (quality is enforced by guardrails + the test layers in
  [§10.1](../../MVP/TECHNICAL_SPEC.md#101-test-layers), not a % threshold).

## Where this gets built

The CI workflow itself is **issue [P00-06]** in
[projects/00-foundation-derisk/PROJECT.md](projects/00-foundation-derisk/PROJECT.md). It must exist
before any feature project merges, so the gates apply from the first wedge PR.
