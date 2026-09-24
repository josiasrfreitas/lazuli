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

Standard operational listings use the [DataTable API](data-tables.md). Pages declare columns,
data and actions; the shared component owns the frame, density, states and pagination.

## Design-system workflow

- Add tokens when a real component or state needs them; avoid speculative token catalogs.
- Components consume semantic tokens rather than reference colors or raw color values.
- Keep the Storybook hierarchy shallow: `Foundations/*` for system foundations and `Components/*`
  for shared components.
- Document a component's variants, sizes, meaningful states, and accessibility requirements with
  Controls and focused interaction coverage.
- Keep source code, technical documentation, and Storybook examples in English unless a work item
  explicitly identifies user-facing content that must be localized.

### Design-system lint

`apps/web/eslint.config.js` owns the `@shadcn/lint` policy for frontend product source. Run it with
`pnpm -F @lazuli/web lint`; the repository-wide `pnpm lint` command exercises the same policy in
the normal Turbo and CI path.

| Rule                            | Severity |
| ------------------------------- | -------- |
| `shadcn/no-inline-styles`       | error    |
| `shadcn/no-restyle`             | warning  |
| `shadcn/no-arbitrary-values`    | warning  |
| `shadcn/no-raw-colors`          | warning  |
| `shadcn/no-unknown-classes`     | warning  |
| `shadcn/require-static-classes` | warning  |

Consumers may control layout around shared components. Internal spacing, shape, typography,
color, and state styling belong to the primitive and should use its existing size or variant.
The active contract and diagnostic guidance live in `apps/web/eslint.config.js`; the measured
findings and promotion criteria live in `.design/shadcn-lint/BASELINE.md`.

Warnings are a bounded migration inventory, not blanket permission for new violations. For a
justified exception, first check whether an existing variant, semantic token, or parent layout
expresses the intent. If not, document the visual reason in the work item and propose either a
narrow component contract or a reusable shared API. Do not add inline ESLint disables: this
repository forbids them.

## Forms

Product forms follow [the form standard](forms.md): a real `form` so Enter submits, first-field
focus, one Tab stop per control, placeholders as format hints, masked dates and phones, pills for a
handful of options, and a per-form contract test. The reference is the `Patterns/DenseForm` story.

Run `pnpm storybook` for visual review. Before finishing frontend changes, run proportionate lint,
typecheck, tests, `git diff --check`, and inspect the final diff.
