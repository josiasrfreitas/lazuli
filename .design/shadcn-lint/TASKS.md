# Instrumentation Plan: `@shadcn/lint`

Generated from: repository inspection and the instrumentation request  
Date: 2026-09-14

## Outcome

Instrument `@shadcn/lint` in the Lazuli frontend so design-system policies are visible to humans and
coding agents, then promote proven policies into the existing lint gate without disrupting valid UI
decisions.

The integration is eligible because the repository uses Node 22, ESLint 10, TypeScript/TSX, and
Tailwind CSS 4. The package requires Node 20.19+, ESLint 9.30+, and Tailwind CSS 4. The web app also
has a `components.json` file and a shared component library, although its root imports from
`@lazuli/ui` require explicit discovery validation.

Primary reference: <https://github.com/shadcn-ui/lint>

## Scope

### Included

- Install and pin `@shadcn/lint` through the existing pnpm catalog convention.
- Register the ESLint plugin only for frontend TSX/JSX checked by `apps/web`.
- Preserve the existing TypeScript parser, flat config, lint command, Turbo task, and CI workflow.
- Configure or validate discovery for:
  - shared components imported from `@lazuli/ui`;
  - component implementations exported from `packages/ui/src/components`;
  - Tailwind theme sources imported through `apps/web/src/app/globals.css` and
    `packages/ui/src/styles`;
  - built-in class/variant helpers already used by the repository (`cn` and `cva`).
- Establish a measured baseline for all six current rules: `no-restyle`, `no-raw-colors`,
  `no-arbitrary-values`, `no-inline-styles`, `no-unknown-classes`, and
  `require-static-classes`.
- Immediately gate only rules that have a clean baseline and correctly understand Lazuli's semantic
  tokens.
- Introduce warnings for useful policies that still require contracts or remediation, accompanied
  by a recorded violation inventory and promotion criteria.
- Add project-specific guidance to diagnostics where the generic fix would not tell an agent which
  Lazuli primitive, variant, token, or document to use.
- Document operation and the location of design-system lint policy in the current frontend guide.

### Excluded

- Replacing ESLint with Oxlint or adding a second lint pipeline.
- Linting backend, worker, domain, API, database, validator, or integration packages with design
  system rules.
- Treating `packages/ui` component implementation classes as consumer-side restyling.
- Redesigning components, changing approved visual behavior, or replacing intentional arbitrary
  values merely to obtain a zero baseline.
- Enabling every rule as an error in the first change.
- Editing generated files, historical documents, migrations, fixtures, or unrelated lint policy.
- Creating a new CI job when the existing `pnpm lint` path can carry the checks.

## Policy and rollout decisions

1. `apps/web/eslint.config.js` owns rule activation and frontend-specific discovery. The shared
   `@lazuli/eslint-config` continues to own generic repository policy.
2. `@shadcn/lint` is a direct development dependency of the package that imports it; its version is
   declared in the root pnpm catalog and resolved in the lockfile.
3. The plugin targets product UI source in `apps/web/src/**/*.{js,jsx,ts,tsx}`. Shared component
   implementations remain under their existing package lint and are excluded from consumer
   `no-restyle` policy.
4. An explicit `componentImports` pattern for `^@lazuli/ui(/|$)` is preferred unless a verification
   proves `components.json` discovers the actual root imports. Configuration follows observed
   behavior, not assumption.
5. Rule rollout has two levels:
   - **Gate now:** severity `error`, only after a clean and correctly resolved baseline.
   - **Observe:** severity `warn`, with a finite inventory and an owner/action for each class of
     finding. Warnings are not considered permanent enforcement.
6. Likely initial candidates for `error` are `no-raw-colors`, `no-unknown-classes`, and
   `require-static-classes`, subject to the baseline. `no-restyle` and `no-arbitrary-values` begin as
   characterization candidates because current pages contain legitimate component overrides and
   arbitrary values. `no-inline-styles` is promoted only after checking whether imported shared
   implementation details are reported.
7. Existing visual intent wins over a generic lint recommendation. Repeated valid exceptions should
   become component variants, semantic tokens, or narrow contracts; unexplained blanket disables
   are not accepted.

## Acceptance criteria

- [ ] `pnpm install --frozen-lockfile` succeeds from a clean checkout with the new dependency and
      catalog entry.
- [ ] `pnpm -F @lazuli/web lint` loads `@shadcn/lint` through the existing flat config without parser,
      module-resolution, or configuration errors.
- [ ] The plugin applies to `apps/web` UI source and does not apply design-system rules to backend or
      worker packages.
- [ ] A controlled verification proves that a component imported from `@lazuli/ui` is recognized as
      a component; merely proving that ESLint can import the plugin is insufficient.
- [ ] A controlled verification proves that a valid Lazuli semantic token/class is accepted and an
      unknown or raw test class is reported by the intended rule.
- [ ] The baseline report records each enabled rule, severity, finding count, representative
      locations, and disposition: fix, contract, intentional exception, or deferred policy.
- [ ] No rule is promoted to `error` while it reports an unexplained existing violation.
- [ ] Consumer contracts allow only intentional responsibilities such as layout or surrounding
      margin; component-owned padding, shape, typography, and state styling remain protected unless
      explicitly justified.
- [ ] `pnpm lint` exercises the plugin through the existing Turbo/CI path and finishes with no new
      errors. Any observation-stage warnings are reported in the handoff with their count.
- [ ] `pnpm typecheck`, `pnpm format:check`, and `git diff --check` pass.
- [ ] The complete diff contains only dependency/configuration, focused verification, baseline, and
      current frontend documentation changes required by this instrumentation.
- [ ] `docs/frontend/README.md` states which rules are errors versus warnings, where contracts live,
      how to run the check, and how to request a justified exception.

## Implementation tasks

### Foundation

- [x] **Register the plugin in the frontend lint boundary**: add the catalog entry and direct web
      development dependency, register the plugin after the existing shared config, and scope it to
      frontend source without enabling rules yet. _Modifies: root `pnpm-workspace.yaml`,
      `apps/web/package.json`, `apps/web/eslint.config.js`, and `pnpm-lock.yaml`; reuses the existing
      ESLint parser and Turbo lint task._

- [x] **Prove monorepo component and theme discovery**: run focused lint probes against a temporary
      frontend TSX file using an `@lazuli/ui` component, one semantic class, and one deliberately
      invalid class; add only the smallest `settings.shadcn` configuration required by the observed
      result. _Modifies: `apps/web/eslint.config.js` only if discovery needs help; reuses
      `apps/web/components.json`, package exports, `cn`, `cva`, and existing CSS theme sources._

### Policy characterization

- [x] **Capture the six-rule baseline**: execute every available rule against current `apps/web`
      source, classify findings by rule and intent, and save a concise report beside this plan. The
      report must call out known hotspots such as login restyling, table widths, form grid columns,
      and marquee layout values. _Creates: `.design/shadcn-lint/BASELINE.md`; reuses existing pages
      and shared components without changing them._

- [x] **Enable clean, high-confidence gates**: configure as `error` only rules whose baseline is
      clean after successful theme discovery, adding Lazuli-specific diagnostic guidance where it
      materially improves the suggested fix. _Modifies: `apps/web/eslint.config.js`; reuses semantic
      tokens and the existing `pnpm lint` gate. Depends on: discovery and baseline._

- [x] **Introduce bounded observation rules**: configure useful non-clean rules as `warn` only when
      the baseline documents every finding category and a concrete path exists to fix or model it.
      Do not add warnings with no planned disposition. _Modifies: `apps/web/eslint.config.js` and
      `.design/shadcn-lint/BASELINE.md`. Depends on: baseline._

### Contracts and migration

- [x] **Model shared-component ownership contracts**: define narrow `no-restyle` contracts for
      actual consumer needs, starting with the most reused primitives (`Button`, `Input`, table
      parts, dialog parts, form layout, and alerts). Prefer existing size/variant props and propose a
      shared component API change when the same valid override repeats. _Modifies:
      `apps/web/eslint.config.js`; may propose, but does not silently expand into, component redesign.
      Depends on: baseline._

- [ ] **Resolve actionable frontend violations**: fix genuine design-system drift in small vertical
      slices, preserving visual behavior and accessibility; keep approved one-off layout values only
      through supported rule options or documented narrow exceptions. _Modifies: only affected
      `apps/web` components and their relevant tests; reuses shared primitives and tokens. Depends
      on: contracts._

- [ ] **Promote mature policies to enforcement**: change an observation rule from `warn` to `error`
      only when its baseline is zero, valid use cases are represented by contracts/tokens/variants,
      and the full lint path passes. Record rules intentionally left in observation with a concrete
      reason. _Modifies: `apps/web/eslint.config.js` and baseline report. Depends on: remediation._

### Documentation and verification

- [x] **Document the agent-facing workflow**: add the active rule matrix, contract location,
      exception process, and `pnpm -F @lazuli/web lint`/`pnpm lint` commands to the current frontend
      guide. _Modifies: `docs/frontend/README.md`; reuses current design-system guidance._

- [x] **Run proportionate verification and inspect the result**: load `ship-with-tests`, justify
      whether a durable automated test is needed for the static ESLint configuration, run the web
      lint first, then repository lint, typecheck, format check, `git diff --check`, and inspect the
      complete diff. Record any check delegated to CI with a concrete reason. _Reuses existing test
      and CI infrastructure; creates no product component._

## Completion boundary

Instrumentation is complete when the plugin is exercised by the normal frontend lint path,
component/theme discovery is demonstrated, at least one useful policy is enforced as an error, all
remaining enabled warnings have a finite documented migration path, and the acceptance checks pass.
Installing the package or registering a plugin with zero active rules is setup, not completed
instrumentation.
