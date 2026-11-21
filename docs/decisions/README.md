# Engineering decisions

Decision records preserve durable engineering constraints that were explicitly accepted. A work
item, not this directory, owns changing feature scope, acceptance criteria, dependencies, and tests.
Code, configuration, and tests show implementation and enforcement; they do not silently replace an
accepted decision.

Create a record for a long-lived engineering choice with a material effect on architecture,
interfaces, data, or operations. Do not create one for delivery sequencing, a feature's current
scope, acceptance criteria, or unresolved product details.

Records use `NNNN-kebab-case.md` names and one of `Proposed`, `Accepted`, `Superseded`, or
`Rejected` statuses. Change an accepted choice by creating a new record and cross-linking it; do
not rewrite history.

| Record                                                                                                              | Status     |
| ------------------------------------------------------------------------------------------------------------------- | ---------- |
| [0001 Runtime topology](0001-runtime-topology.md)                                                                   | Accepted   |
| [0002 Typed BFF and package boundaries](0002-typed-bff-and-package-boundaries.md)                                   | Accepted   |
| [0003 Background-work boundary](0003-background-work-boundary.md)                                                   | Accepted   |
| [0004 Staff authentication](0004-staff-authentication.md)                                                           | Superseded |
| [0005 Academic and commercial calendar separation](0005-separate-academic-and-commercial-calendars.md)              | Accepted   |
| [0006 Class modality axes](0006-model-class-modality-as-independent-axes.md)                                        | Accepted   |
| [0007 Derived receivables ledger](0007-model-receivables-as-a-payer-scoped-derived-ledger.md)                       | Accepted   |
| [0008 Academic catalog hierarchy](0008-model-the-academic-catalog-hierarchy.md)                                     | Accepted   |
| [0009 Enrollment and pedagogical placement](0009-separate-enrollment-from-pedagogical-placement.md)                 | Accepted   |
| [0010 Student contacts and shared addresses](0010-model-student-contacts-and-shared-addresses.md)                   | Accepted   |
| [0011 Common domain-record lifecycle](0011-use-a-common-domain-record-lifecycle.md)                                 | Accepted   |
| [0012 Receivables module API](0012-expose-receivables-through-one-module-api.md)                                    | Superseded |
| [0013 GCP and Pulumi for managed infrastructure](0013-use-gcp-and-pulumi-for-managed-infrastructure.md)             | Accepted   |
| [0014 PostgreSQL through Prisma](0014-use-postgresql-through-prisma.md)                                             | Accepted   |
| [0015 Base UI primitives for the design system](0015-use-base-ui-primitives-for-the-design-system.md)               | Accepted   |
| [0016 Kysely for complex relational reads](0016-use-kysely-for-complex-relational-reads.md)                         | Accepted   |
| [0017 Mutation score and assertion guardrails](0017-gate-tests-on-mutation-score-and-assertion-guardrails.md)       | Accepted   |
| [0018 Finance module API](0018-expose-finance-through-one-module-api.md)                                            | Accepted   |
| [0019 Unit-only mutation](0019-limit-mutation-to-unit-tests.md)                                                     | Accepted   |
| [0020 Remove changed-source coverage gate](0020-remove-changed-source-coverage-gate.md)                             | Accepted   |
| [0021 Exclude frontend from mutation](0021-exclude-frontend-from-mutation.md)                                       | Accepted   |
| [0022 Restrict global settings to system administrators](0022-restrict-global-settings-to-system-administrators.md) | Accepted   |
| [0023 Remove mutation testing](0023-remove-mutation-testing.md)                                                     | Accepted   |
| [0024 Rebuild development data through one seed](0024-rebuild-development-data-through-one-seed.md)                 | Accepted   |
| [0025 AWS for managed infrastructure](0025-use-aws-for-managed-infrastructure.md)                                   | Accepted   |
| [0026 Email and password staff authentication](0026-email-password-staff-authentication.md)                         | Accepted   |
| [0027 One prorated monthly interest calculator](0027-use-one-prorated-monthly-interest-calculator.md)               | Accepted   |

Use this compact template:

```text
# Decision title

Status: Accepted
Decision date: Unknown
Extraction date: YYYY-MM-DD
Supersedes: None
Superseded by: None
Implementation evidence: …
```
