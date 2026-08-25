# Frontend guide

This is the starting point for current Lazuli frontend work. Historical frontend plans under
`docs/legacy/` are provenance only and do not define current requirements.

## Component boundary

**Hard rule: a component implementation file must not exceed 200 physical lines.** Imports,
types, variants, and the component body all count toward the limit. When a component approaches the
limit, extract meaningful subcomponents, hooks, or pure helpers; do not compress formatting or hide
unrelated responsibilities merely to satisfy the count. `pnpm test:component-lines` enforces this
boundary for shared UI components and web React source files.

Keep shared primitives in `packages/ui` and product-specific compositions in `apps/web`. The web app
must not import Prisma or worker handlers.

## Design-system workflow

- Add tokens when a real component or state needs them; avoid speculative token catalogs.
- Components consume semantic tokens rather than reference colors or raw color values.
- Keep the Storybook hierarchy shallow: `Foundations/*` for system foundations and `Components/*`
  for shared components.
- Document a component's variants, sizes, meaningful states, and accessibility requirements with
  Controls and focused interaction coverage.
- Keep source code, technical documentation, and Storybook examples in English unless a work item
  explicitly identifies user-facing content that must be localized.

Run `pnpm storybook` for visual review. Before finishing frontend changes, run proportionate lint,
typecheck, tests, `git diff --check`, and inspect the final diff.
