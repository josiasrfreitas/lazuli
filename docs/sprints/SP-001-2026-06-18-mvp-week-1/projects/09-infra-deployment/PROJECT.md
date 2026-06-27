# [P09] Infra & deployment

**Increment:** Cross-cutting
**Status:** `blocked` (web-host + Cloud SQL connectivity decision open)
**Depends on:** P00
**Blocks:** production cutover only — not feature development

## Goal

The Pulumi-defined GCP footprint and the deploy path. Resource definitions can proceed in parallel
with feature work; **cutover is blocked** on the open web-host / Cloud SQL connectivity decision
([§11](../../../../MVP/TECHNICAL_SPEC.md#11-deployment-and-infra), PRD §15.9).

## Spec anchors

- Technical Spec: §2.2, §9.4, §11
- Decisions: D-0003, D-0004, D-0007

## Issues

### Pulumi base stack (state, buckets, registry, service accounts, secrets)

- **Status:** `ready-for-agent`
- **Depends on:** GRE-5
- **Trace:** §11, §9.4, D-0003
- **Goal:** Pulumi TS stacks: GCS buckets (artifacts + Pulumi state), Artifact Registry repo, least-privilege web/worker service accounts, Secret Manager references (DB, Better Auth, Google OAuth, Resend, Portal).
- **Acceptance:**
  - [ ] Stack provisions buckets/registry/SAs/secret refs; state in the GCS state bucket.
  - [ ] No secret values committed; only references.

### Worker Cloud Run service (Playwright-capable image)

- **Status:** `ready-for-agent`
- **Depends on:** GRE-54, GRE-5
- **Trace:** §2.2, §11, D-0004
- **Goal:** One Cloud Run service for the single Hatchet worker; Playwright-capable image; low concurrency; built/pushed to Artifact Registry.
- **Acceptance:**
  - [ ] Worker image builds and deploys to Cloud Run; connects to Hatchet Cloud.
  - [ ] Portal handlers run here at low concurrency (re-split only if load later justifies, §2.1).

### Web host wiring + Cloud SQL connectivity (BLOCKED — decision)

- **Status:** `blocked` (needs host decision)
- **Depends on:** GRE-54
- **Trace:** §11, PRD §15.9
- **Goal:** Once host is chosen (Railway leading, Vercel alternative), specify Cloud SQL access method (SSL/Auth Proxy or direct), migration runner, secret injection, and staging/preview behavior.
- **Acceptance:**
  - [ ] Follow-up infra decision recorded in `decisions.md` before any cutover.
  - [ ] Web app reaches Cloud SQL PG16; migrations run via the chosen runner.
- **Open items:** web host, Cloud SQL connectivity, staging (§1.3 / PRD §15.9).

## Definition of done (project)

- [ ] Pulumi stack + worker Cloud Run service deployable; web cutover unblocked only after the host decision lands.
