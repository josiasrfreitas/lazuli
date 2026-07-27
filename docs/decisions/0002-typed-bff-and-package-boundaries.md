# Typed BFF and package boundaries

Status: Accepted
Decision date: Unknown
Extraction date: 2026-07-27
Supersedes: None
Superseded by: None
Legacy sources: [D-0002](../legacy/2026-07-27/MVP/decisions.md#d-0002-t3-turbo-and-trpc-bff) (Accepted)
Implementation evidence: [`packages/api/`](../../packages/api/), [`tooling/eslint/boundaries.js`](../../tooling/eslint/boundaries.js)

## Context

The monorepo needs typed client/server communication and enforceable ownership boundaries.

## Decision

Use the T3 Turbo monorepo shape with a tRPC BFF. Business logic, RBAC, and data access belong in
tRPC procedures and shared packages; do not add a separate REST or GraphQL backend for this MVP.

## Consequences

Package import directions are enforced in configuration rather than treated as advisory.

## Alternatives

Not recorded; do not reconstruct.

## Unknowns and non-goals

This record does not duplicate every package-specific lint rule.
