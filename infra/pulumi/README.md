# infra/pulumi

Pulumi (TypeScript) stacks for GCP resources, with state in a GCS bucket
(TECHNICAL_SPEC §2.1, §11).

**Status:** placeholder. Not part of the Sprint-0 foundation scaffold (P00-01).

Planned stack (§11) creates: GCS buckets (artifacts + Pulumi state), least-privilege
service accounts for web/worker, secret references (DB, Better Auth, Google OAuth,
Resend, SGF), one Cloud Run service for the single `worker`, and an Artifact Registry
repository. Deployment remains blocked on the open web-host / Cloud SQL connectivity
decision (§11).
