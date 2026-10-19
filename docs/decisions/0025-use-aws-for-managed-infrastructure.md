# Use AWS for managed infrastructure

Status: Accepted
Decision date: 2026-10-19
Supersedes: The GCP provider choice in [0013](0013-use-gcp-and-pulumi-for-managed-infrastructure.md)
Superseded by: None
Source: Owner instruction on 2026-10-19; [work item #190](https://github.com/josiasrfreitas/lazuli/issues/190)
Implementation evidence: [`packages/storage`](../../packages/storage/), [`docker-compose.yml`](../../docker-compose.yml)

## Context

The owner's Google Cloud credits expired. The owner chose AWS for the managed infrastructure.

## Decision

Use AWS for managed resources and Amazon S3 for object storage. Preserve Pulumi as the previously
accepted infrastructure-as-code tool. Application storage operations belong to `packages/storage`.
Local development uses an S3-compatible service with isolated workspace buckets and no AWS credentials.

## Consequences

New storage work targets S3. Existing GCP configuration and bootstrap resources remain until their
migration is implemented; their presence is not a renewed choice of GCP. Student records remain
in PostgreSQL. File metadata and access control remain in the application; private files live in S3.

## Unknowns and non-goals

This decision does not provision AWS resources, migrate data, or claim deployment readiness.
Database service, hosting, region, networking, secrets, cost, backup/retention and cutover require
a separate infrastructure work item. No particular AWS database or hosting service is selected here.
