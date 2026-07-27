# Staff authentication

Status: Accepted
Decision date: Unknown
Extraction date: 2026-07-27
Supersedes: None
Superseded by: None
Legacy sources: [D-0005](../legacy/2026-07-27/MVP/decisions.md#d-0005-better-auth) (Accepted)
Implementation evidence: [`packages/auth/`](../../packages/auth/), [`packages/api/src/trpc/rbac.ts`](../../packages/api/src/trpc/rbac.ts)

## Context

Staff access needs an identity mechanism separate from application authorization.

## Decision

Use Better Auth with Google OAuth as primary sign-in and magic link as fallback. Authentication proves
identity; authorization requires a pre-provisioned staff user and is enforced in tRPC middleware.

## Consequences

Unknown staff email addresses are rejected or held for approval. Better Auth magic-link delivery
remains part of the accepted authentication mechanism.

## Alternatives

Not recorded; do not reconstruct.

## Unknowns and non-goals

The enabled role set is changing product scope and is not decided here.
