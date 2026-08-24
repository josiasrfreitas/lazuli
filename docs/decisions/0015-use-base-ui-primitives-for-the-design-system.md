# Use Base UI primitives for the design system

Status: Accepted
Decision date: 2026-08-05
Supersedes: None
Superseded by: None
Legacy sources: None
Implementation evidence: [`packages/ui/src/components/`](../../packages/ui/src/components/), [`pnpm-workspace.yaml`](../../pnpm-workspace.yaml) (`@base-ui/react` catalog entry)

## Context

The shared UI package (`packages/ui`) follows the shadcn model: components are owned code, built
as thin styled wrappers over an unstyled headless primitive library. Hard interaction behavior —
focus management, keyboard navigation, portals, ARIA wiring — lives in the primitive library;
the wrappers add only semantic-token styling and a stable component contract. One primitive
library must be chosen, because mixing two would fragment composition patterns, portal and focus
behavior, and bundle weight.

## Decision

Use `@base-ui/react` (Base UI, 1.x) as the single headless primitive layer for all design-system
components. Wrappers style Base UI primitives with the semantic token layer and expose the
package's component contracts; they do not reimplement interaction behavior. Radix UI is not
used, not even for individual components.

Base UI was chosen over Radix because:

- Base UI is the actively developed continuation of the same lineage — its team combines the
  original Radix, Floating UI, and MUI authors — while Radix has been in effective maintenance
  mode since its stewardship changed around 2024.
- Base UI is stable (1.0 in 2025) with a single package and a uniform API: one `render` prop
  composition pattern (avoiding `asChild` pitfalls) and consistent `data-*` state attributes,
  which the wrappers rely on directly.
- The main advantages of Radix — a larger ecosystem and copy-paste compatibility with upstream
  shadcn — do not outweigh an inactive trajectory for a foundation the design system must sit
  on for years.

## Consequences

Upstream shadcn snippets cannot be copied verbatim; each component is ported onto Base UI as it
enters the design system. If Base UI lacks a needed primitive, first build it from lower-level
Base UI parts; introducing a second primitive library requires superseding this record.

## Alternatives

Radix UI (rejected: maintenance trajectory, fragmented multi-package API). Using both libraries
side by side (rejected: two composition and portal models would break contract uniformity).

## Unknowns and non-goals

This record does not choose the styling approach, token system, or component API contracts; it
covers only the primitive layer.
