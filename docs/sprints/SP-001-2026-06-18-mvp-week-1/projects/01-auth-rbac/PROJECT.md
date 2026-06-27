# [P01] Auth & RBAC

**Increment:** Increment 1 (Wedge)
**Status:** `ready-for-agent`
**Depends on:** P00
**Blocks:** every app surface (P02–P08)

## Goal

Staff sign-in and the role/permission backbone every other procedure depends on. Pre-provisioned
ADMIN/TEACHER users, Google + magic-link, and a tested RBAC layer (`ctx.staffUser`, teacher resource
scope) so feature work can assume authorization is solved.

## Spec anchors

- PRD: S-AUTH-1, S-AUTH-2
- Technical Spec: §4.1, §5.2, §8 (UI boundaries)
- Decisions: D-0005, D-0016

## Issues

### Better Auth: Google + magic link, pre-provisioned staff

- **Status:** `ready-for-agent`
- **Depends on:** P00-03
- **Trace:** §4.1, S-AUTH-1, D-0005
- **Goal:** Better Auth in `packages/auth`; Google OAuth + magic link via Resend/Mailpit; pre-provisioned `User` rows; unknown-email rejection boundary; 30-day sessions; sign-out.
- **Acceptance:**
  - [ ] Sign-in works with Google and magic link; unknown emails are rejected (no self-signup).
  - [ ] Sessions last 30 days; sign-out invalidates.
  - [ ] Staff soft-disabled via `User.isEnabled` (no deletes) — disabled users cannot sign in.

### RBAC middleware + role matrix + `ctx.staffUser`

- **Status:** `ready-for-agent`
- **Depends on:** P01-01
- **Trace:** §5.2, S-AUTH-2, D-0016
- **Goal:** tRPC RBAC middleware enforcing the §5.2 matrix for `ADMIN`/`TEACHER`; `ctx.staffUser`; teacher resource-scope checks (own classes only); 403 on violation. `SECRETARY`/`FINANCE` enum values exist but are not enabled.
- **Acceptance:**
  - [ ] Procedures declare required role; unauthorized → 403.
  - [ ] Teacher reads/writes restricted to owned resources (verified by tRPC integration tests, §10.1).
  - [ ] No impersonation in MVP.

### Role-based app shell & menu (pt-BR)

- **Status:** `ready-for-agent`
- **Depends on:** P01-02
- **Trace:** S-AUTH-2, §8
- **Goal:** Authenticated app shell with role-filtered navigation; Portuguese-BR labels; teacher lands on teacher home, admin on admin dashboard (cards filled in by their owning projects).
- **Acceptance:**
  - [ ] Menu shows only items the role may access.
  - [ ] Mobile-friendly shell (teachers are mobile-first).

## Definition of done (project)

- [ ] Auth + RBAC covered by tRPC integration tests (RBAC and teacher scope, §10.1).
- [ ] Downstream procedures can rely on `ctx.staffUser` and role guards.
