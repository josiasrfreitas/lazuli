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

| Record                                                                                                  | Status   | Legacy source          |
| ------------------------------------------------------------------------------------------------------- | -------- | ---------------------- |
| [0001 Runtime topology](0001-runtime-topology.md)                                                       | Accepted | D-0001                 |
| [0002 Typed BFF and package boundaries](0002-typed-bff-and-package-boundaries.md)                       | Accepted | D-0002                 |
| [0003 Background-work boundary](0003-background-work-boundary.md)                                       | Accepted | D-0004                 |
| [0004 Staff authentication](0004-staff-authentication.md)                                               | Accepted | D-0005                 |
| [0005 Academic and commercial calendar separation](0005-separate-academic-and-commercial-calendars.md)  | Accepted | D-0008, D-0011         |
| [0006 Class modality axes](0006-model-class-modality-as-independent-axes.md)                            | Accepted | D-0021                 |
| [0007 Derived receivables ledger](0007-model-receivables-as-a-payer-scoped-derived-ledger.md)           | Accepted | D-0025, D-0028, D-0032 |
| [0008 Academic catalog hierarchy](0008-model-the-academic-catalog-hierarchy.md)                         | Accepted | D-0030                 |
| [0009 Enrollment and pedagogical placement](0009-separate-enrollment-from-pedagogical-placement.md)     | Accepted | D-0022, D-0031         |
| [0010 Student contacts and shared addresses](0010-model-student-contacts-and-shared-addresses.md)       | Accepted | D-0033                 |
| [0011 Common domain-record lifecycle](0011-use-a-common-domain-record-lifecycle.md)                     | Accepted | D-0034                 |
| [0012 Receivables module API](0012-expose-receivables-through-one-module-api.md)                        | Accepted | D-0037                 |
| [0013 GCP and Pulumi for managed infrastructure](0013-use-gcp-and-pulumi-for-managed-infrastructure.md) | Accepted | D-0003                 |
| [0014 PostgreSQL through Prisma](0014-use-postgresql-through-prisma.md)                                 | Accepted | Accepted legacy stack  |
| [0015 Base UI primitives for the design system](0015-use-base-ui-primitives-for-the-design-system.md)   | Accepted | None                   |
| [0016 Kysely for complex relational reads](0016-use-kysely-for-complex-relational-reads.md)             | Accepted | None                   |

The archived register's complete disposition is: extracted — D-0001, D-0002, D-0003, D-0004,
D-0005, D-0008, D-0021, D-0025, D-0028, D-0030 through D-0034, and D-0037; universal AGENTS rule
— D-0006; work-item/product behavior — D-0009 through D-0011, D-0016 through D-0018, D-0023,
D-0024, D-0026, D-0029, and D-0036; unresolved owner decision — D-0007, D-0012, and D-0014;
legacy-only — D-0013, D-0015, D-0019, D-0020, D-0027, and D-0035; superseded — D-0022.

Use this compact template:

```text
# Decision title

Status: Accepted
Decision date: Unknown
Extraction date: YYYY-MM-DD
Supersedes: None
Superseded by: None
Legacy sources: …
Implementation evidence: …
```
