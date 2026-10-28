# Email and password staff authentication

Status: Accepted
Decision date: 2026-10-28
Supersedes: [0004](0004-staff-authentication.md)
Superseded by: None
Implementation evidence: [`packages/auth/`](../../packages/auth/), [`login`](../../apps/web/src/app/login/)

## Decision

Use Better Auth with email and password as the primary staff sign-in method and retain magic
links as an alternative. This replaces the Google OAuth requirement in ADR 0004, following the
owner's request to add password access to the existing flow.

Staff identities remain provisioned by the school; public registration is disabled for both
methods. Authentication proves identity, while existing staff eligibility and application
permissions continue to authorize access.

## Consequences

Existing users can create their first password through the same email ownership verification
flow used for password recovery. Better Auth owns credential hashing, single-use expiring reset
tokens and session persistence. Resetting a password revokes existing sessions. No password is
sent by email, and neither the school nor a public sign-up form chooses a user's password.
Staff eligibility is checked again when a reset token is used. Authentication rate limits use
the shared PostgreSQL database so requests across app instances count toward the same limit.
