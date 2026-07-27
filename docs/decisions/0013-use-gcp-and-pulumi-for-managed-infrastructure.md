# Use GCP and Pulumi for managed infrastructure

Status: Accepted
Decision date: Unknown
Extraction date: 2026-07-27
Supersedes: None
Superseded by: None
Legacy sources: [D-0003](../legacy/2026-07-27/MVP/decisions.md#d-0003-gcp-and-pulumi) (Accepted)
Implementation evidence: [`infra/pulumi/`](../../infra/pulumi/), [`infra/pulumi/README.md`](../../infra/pulumi/README.md)

## Context

Managed production resources need a platform and infrastructure-as-code boundary.

## Decision

Use GCP as the managed-resource platform and Pulumi as the infrastructure-as-code tool.

## Consequences

The decision applies to the managed-resource boundary, not a deployable stack implementation.

## Alternatives

Not recorded; do not reconstruct.

## Unknowns and non-goals

Web hosting, Cloud SQL connectivity, deployment topology, CI/CD, staging, retention, and rollout
remain unresolved.
