# Lazuli ERD

**Status:** derived from [TECHNICAL_SPEC.md](./TECHNICAL_SPEC.md) v0.2  
**Date:** 2026-06-18  
**Source of truth:** [PRD](./PRD.md), [decisions](./decisions.md), and [TECHNICAL_SPEC.md](./TECHNICAL_SPEC.md).

This ERD is split by module so it remains readable in Mermaid renderers. Entity names use uppercase snake case for Mermaid parser stability; for example `SCHOOL_CLASS` corresponds to the Prisma `Class` model and `ORDER_RECORD` corresponds to `Order`.

## Legend

- `PK` primary key.
- `FK` foreign key.
- `UK` unique key or unique-by-constraint.
- **UUIDEntity** — every domain entity in Sections 4.1–4.8 of [TECHNICAL_SPEC.md](./TECHNICAL_SPEC.md) carries `id` (uuid PK), `created_at`, `updated_at`, and nullable `deleted_at` ([D-0034](./decisions.md#d-0034-uuidentity-base-for-all-domain-tables)). These columns are omitted from diagram blocks for brevity; consult the spec for exact nullability and soft-delete rules.
- Optional fields are listed without a Mermaid comment for renderer compatibility; consult [TECHNICAL_SPEC.md](./TECHNICAL_SPEC.md) for exact nullability.
- Repetitive attribution FKs such as `createdById`, `updatedById`, `cancelledById`, and `lastModifiedById` all reference `USER.id` with `ON DELETE RESTRICT`; most are omitted from relationship lines to keep the diagrams readable.
- Better Auth adapter tables are intentionally omitted. Authentication joins to `USER` by email, and domain authorization uses `ctx.staffUser.id`.

## Academic Core

```mermaid
erDiagram
  USER {
    string id PK
    string email UK
    string name
    UserRole role
    boolean isEnabled
  }

  STUDENT {
    string id PK
    string fullName
    string phone
    string email
    date birthDate
    DocumentType documentType
    string documentNumber
    string addressId FK
    string guardianId FK
    StudentStatus status
    string notes
  }

  GUARDIAN {
    string id PK
    string fullName
    string relationship
    DocumentType documentType
    string documentNumber
    string phone
    string email
    string addressId FK
  }

  ADDRESS {
    string id PK
    string street
    string number
    string complement
    string neighborhood
    string city
    string state
    string postalCode
  }

  PRODUCT_LINE {
    string id PK
    string key UK
    string name UK
    CatalogStatus status
    string portalPrefix
  }

  TRACK {
    string id PK
    string productLineId FK
    string name
    CatalogStatus status
    string portalPrefix
  }

  STAGE {
    string id PK
    string trackId FK
    string name
    string internalCode
    int sequence
  }

  SEMESTER {
    string id PK
    string name UK
    date startDate
    date endDate
  }

  SCHOOL_CLOSED_DAY {
    string id PK
    date date UK
    string reason
    string createdById FK
  }

  SCHOOL_CLASS {
    string id PK
    string internalCode UK
    string teacherId FK
    ClassScheduleType scheduleType
    ClassFormat format
    string sharedStageId FK
    string semesterId FK
    int year
    int capacity
    ClassStatus status
    string previousClassId FK
    string portalClassName
    string originalPortalClassName
  }

  CLASS_SCHEDULE_SLOT {
    string id PK
    string classId FK
    Weekday weekday
    time startTime
    time endTime
  }

  CLASS_SESSION {
    string id PK
    string classId FK
    string scheduleSlotId FK
    date date
    time startTime
    time endTime
    ClassSessionStatus status
    string cancelReason
    datetime cancelledAt
    datetime attendanceConfirmedAt
    string attendanceConfirmedById FK
    datetime attendanceLastCommittedAt
    datetime portalSubmittedAt
  }

  Portal_RUN {
    string id PK
    string classSessionId FK
    datetime queuedAt
    datetime attemptedAt
    datetime succeededAt
    datetime failedAt
    string errorCode
    string errorMessage
    string jobId
  }

  USER ||--o{ SCHOOL_CLASS : teaches
  GUARDIAN ||--o{ STUDENT : responsible_for
  ADDRESS ||--o{ STUDENT : student_address
  ADDRESS ||--o{ GUARDIAN : guardian_address
  TRACK ||--o{ STAGE : contains
  STAGE ||--o{ SCHOOL_CLASS : shared_stage
  SEMESTER ||--o{ SCHOOL_CLASS : generation_window
  SCHOOL_CLASS ||--o{ SCHOOL_CLASS : previous_class_lineage
  SCHOOL_CLASS ||--o{ CLASS_SCHEDULE_SLOT : has_slots
  SCHOOL_CLASS ||--o{ CLASS_SESSION : has_sessions
  CLASS_SCHEDULE_SLOT ||--o{ CLASS_SESSION : generates
  CLASS_SESSION ||--o{ Portal_RUN : portal_runs
```

Key constraints from the spec:

- `GUARDIAN` replaces the former free-text `responsibleText` ([D-0033](./decisions.md#d-0033-structured-guardian-and-address-entities)). A minor `STUDENT` must have a `guardianId`; `STUDENT.guardianId` is many-to-one (siblings may share a guardian). The guardian is kept structurally separate from the finance `PAYER` — no FK between them.
- `STUDENT.addressId` and `GUARDIAN.addressId` are shareable FKs (`ON DELETE SET NULL`): a cohabiting student and guardian may point at the same `ADDRESS` row.
- `documentType` + `documentNumber` (on `STUDENT` and `GUARDIAN`) are paired: `documentNumber` set requires `documentType` set (`enum DocumentType { CPF, RG }`).
- `SCHOOL_CLASS.scheduleType = REGULAR` requires `sharedStageId` and `semesterId`.
- `SCHOOL_CLASS.scheduleType = PERSONALIZED` requires `sharedStageId = null` and `semesterId` (amended 2026-07-04 — both modalities share the same semester calendar for session generation; see [D-0008](./decisions.md#d-0008-rolling-enrollment-and-contract-periods)).
- Active classes have unique `portalClassName`.
- `SEMESTER` date ranges must not overlap.
- Generated sessions use partial unique indexes because `scheduleSlotId` is nullable.
- `Portal_RUN` records queue/attempt/outcome/error facts for a single `CLASS_SESSION`.
- A generated session date must map to exactly one `SEMESTER` before attendance can be confirmed or reports can be generated.

## Enrollment, Progress, Attendance

```mermaid
erDiagram
  STUDENT {
    string id PK
    string fullName
    StudentStatus status
  }

  SCHOOL_CLASS {
    string id PK
    string internalCode UK
    string teacherId FK
    ClassScheduleType scheduleType
    string sharedStageId FK
    ClassStatus status
  }

  STAGE {
    string id PK
    string trackId FK
    string internalCode
    int sequence
  }

  ENROLLMENT {
    string id PK
    string studentId FK
    string classId FK
    date entryDate
    date exitDate
    EnrollmentExitReason exitReason
    string capacityOverrideReason
  }

  PEDAGOGICAL_PROGRESS {
    string id PK
    string enrollmentId FK
    string stageId FK
    date startDate
    date endDate
    ProgressEndReason endReason
  }

  CLASS_SESSION {
    string id PK
    string classId FK
    date date
    time startTime
    time endTime
    ClassSessionStatus status
    datetime attendanceConfirmedAt
    datetime attendanceLastCommittedAt
    datetime portalSubmittedAt
  }

  Portal_RUN {
    string id PK
    string classSessionId FK
    datetime queuedAt
    datetime attemptedAt
    datetime succeededAt
    datetime failedAt
    string errorCode
    string errorMessage
    string jobId
  }

  ATTENDANCE {
    string id PK
    string enrollmentId FK
    string classSessionId FK
    AttendanceStatus status
    datetime recordedAt
    string recordedById FK
    string notes
    datetime lastModifiedAt
    string lastModifiedById FK
  }

  MAKEUP {
    string id PK
    string originEnrollmentId FK
    string targetClassSessionId FK
    datetime scheduledAt
    string scheduledById FK
    string reason
    datetime attendedAt
    string attendedById FK
    datetime cancelledAt
    string cancelledById FK
    string cancellationReason
  }

  STUDENT ||--o{ ENROLLMENT : enrolls
  SCHOOL_CLASS ||--o{ ENROLLMENT : has_roster
  ENROLLMENT ||--o{ PEDAGOGICAL_PROGRESS : stage_history
  STAGE ||--o{ PEDAGOGICAL_PROGRESS : placed_at
  SCHOOL_CLASS ||--o{ CLASS_SESSION : holds
  ENROLLMENT ||--o{ ATTENDANCE : records
  CLASS_SESSION ||--o{ ATTENDANCE : attendance_for
  ENROLLMENT ||--o{ MAKEUP : origin
  CLASS_SESSION ||--o{ MAKEUP : target_visit
  CLASS_SESSION ||--o{ Portal_RUN : portal_runs
```

Key constraints from the spec:

- Active enrollment is derived from `exitDate IS NULL`; no stored enrollment status.
- Each active enrollment has exactly one active `PEDAGOGICAL_PROGRESS`; each closed enrollment has zero active progress.
- Progress windows for the same enrollment cannot overlap.
- REGULAR active progress must match `SCHOOL_CLASS.sharedStageId`.
- At most one active enrollment per `(student, track)` is allowed.
- `ATTENDANCE` rows are committed only when a session is confirmed; pre-confirm selections are client state only.
- `CLASS_SESSION.attendanceLastCommittedAt > portalSubmittedAt` derives Portal retry eligibility.
- `Portal_RUN` stores Portal queue/attempt/outcome/error facts; `CLASS_SESSION` keeps only the durable `portalSubmittedAt` success fact.
- Makeups do not affect the attendance percentage.

## Finance

```mermaid
erDiagram
  STUDENT {
    string id PK
    string fullName
  }

  PAYER {
    string id PK
    string name
    string taxId
    string phone
    string email
  }

  ORDER_RECORD {
    string id PK
    string payerId FK
    OrderKind kind
    int principalAmountCents
    date startDate
    int dueDay
    string signedOrderArtifactId
    datetime cancelledAt
    string cancelledReason
  }

  ORDER_BENEFICIARY {
    string id PK
    string orderId FK
    string studentId FK
  }

  INSTALLMENT {
    string id PK
    string orderId FK
    int amountCents
    date dueDate
    datetime waivedAt
    string waivedReason
    datetime overdueD30EmailSentAt
  }

  INSTALLMENT_ADJUSTMENT {
    string id PK
    string installmentId FK
    InstallmentAdjustmentType type
    int amountCents
    string reason
    string createdById FK
  }

  PAYMENT_ENTRY {
    string id PK
    string payerId FK
    date date
    int amountCents
    PaymentMethod method
    string note
    string externalReference
    string createdById FK
  }

  PAYMENT_ALLOCATION {
    string id PK
    string paymentEntryId FK
    string installmentId FK
    int amountCents
  }

  FINANCE_SETTINGS {
    string id PK
    decimal interestRatePctMonthly
    datetime updatedAt
    string updatedById FK
  }

  PAYER ||--o{ ORDER_RECORD : places
  ORDER_RECORD ||--o{ ORDER_BENEFICIARY : covers
  STUDENT ||--o{ ORDER_BENEFICIARY : beneficiary
  ORDER_RECORD ||--o{ INSTALLMENT : schedules
  INSTALLMENT ||--o{ INSTALLMENT_ADJUSTMENT : adjusted_by
  PAYER ||--o{ PAYMENT_ENTRY : pays
  PAYMENT_ENTRY ||--o{ PAYMENT_ALLOCATION : split_into
  INSTALLMENT ||--o{ PAYMENT_ALLOCATION : receives
```

Key constraints from the spec:

- All money is integer cents, BRL-only, `Cents` suffix.
- `ORDER_RECORD.kind` is required: `TUITION | ENROLLMENT_FEE | MATERIAL | OTHER`.
- `dueDay IN (5, 10, 15, 20, 25)`.
- Payment allocations are payer-scoped: allocated installments must belong to orders for the same payer as the payment entry.
- `currentExpectedCents >= 0` and `paidAmountCents <= currentExpectedCents` after adjustments.
- Cancelled orders and waived installments are non-collectible; their history remains visible.
- `overdueD30EmailSentAt` is a delivery idempotency fact, not a notification rule engine.
- `FINANCE_SETTINGS.interestRatePctMonthly` drives display-only interest preview; actual charged interest is an `INSTALLMENT_ADJUSTMENT`.

## Artifacts and Cross-Module Links

```mermaid
erDiagram
  USER {
    string id PK
    string email UK
    UserRole role
  }

  STUDENT {
    string id PK
    string fullName
  }

  SCHOOL_CLASS {
    string id PK
    string internalCode UK
  }

  ORDER_RECORD {
    string id PK
    string signedOrderArtifactId
  }

  GENERATED_ARTIFACT {
    string id PK
    ArtifactKind kind
    string requestedById FK
    string studentId FK
    string classId FK
    string orderId FK
    string storageBucket
    string storageObject
    string contentType
    string fileName
    datetime requestedAt
    datetime startedAt
    datetime completedAt
    datetime failedAt
    string errorCode
    string errorMessage
    datetime expiresAt
  }

  USER ||--o{ GENERATED_ARTIFACT : requested
  STUDENT ||--o{ GENERATED_ARTIFACT : student_report
  SCHOOL_CLASS ||--o{ GENERATED_ARTIFACT : class_report
  ORDER_RECORD ||--o{ GENERATED_ARTIFACT : order_artifact
```

Artifact rules:

- Store GCS bucket/object keys, not public or signed URLs.
- Signed URLs are generated on demand.
- `ORDER_RECORD.signedOrderArtifactId` is a nullable UUID placeholder in the finance schema. The generated-artifact FK and `kind = SIGNED_ORDER_PDF` validation are deferred to the artifact workflow slice.
- Retention remains open; `expiresAt` stays nullable.

## Full Relationship Index

| From                  | To                       |        Cardinality | Meaning                                                  |
| --------------------- | ------------------------ | -----------------: | -------------------------------------------------------- |
| `USER`                | `SCHOOL_CLASS`           |          1 to many | Teacher owns classes.                                    |
| `GUARDIAN`            | `STUDENT`                | 1 to many optional | Contact responsável; siblings may share one guardian.    |
| `ADDRESS`             | `STUDENT`                | 1 to many optional | Student address (shareable row).                         |
| `ADDRESS`             | `GUARDIAN`               | 1 to many optional | Guardian address (may be the same row as the student's). |
| `PRODUCT_LINE`        | `TRACK`                  |          1 to many | Seeded product-line grouping.                            |
| `TRACK`               | `STAGE`                  |          1 to many | Course catalog path.                                     |
| `STAGE`               | `SCHOOL_CLASS`           | 1 to many optional | REGULAR shared class stage.                              |
| `SEMESTER`            | `SCHOOL_CLASS`           | 1 to many optional | Generation window for REGULAR and PERSONALIZED classes.  |
| `SCHOOL_CLASS`        | `SCHOOL_CLASS`           | 1 to many optional | Previous/next class lineage.                             |
| `SCHOOL_CLASS`        | `CLASS_SCHEDULE_SLOT`    |          1 to many | Weekly schedule slots.                                   |
| `CLASS_SCHEDULE_SLOT` | `CLASS_SESSION`          | 1 to many optional | Generated session source.                                |
| `SCHOOL_CLASS`        | `CLASS_SESSION`          |          1 to many | Sessions held by class.                                  |
| `STUDENT`             | `ENROLLMENT`             |          1 to many | Operational student-class link.                          |
| `SCHOOL_CLASS`        | `ENROLLMENT`             |          1 to many | Active/historical roster.                                |
| `ENROLLMENT`          | `PEDAGOGICAL_PROGRESS`   |          1 to many | Stage placement history.                                 |
| `STAGE`               | `PEDAGOGICAL_PROGRESS`   |          1 to many | Stage placement target.                                  |
| `ENROLLMENT`          | `ATTENDANCE`             |          1 to many | Committed attendance rows.                               |
| `CLASS_SESSION`       | `ATTENDANCE`             |          1 to many | Session attendance.                                      |
| `ENROLLMENT`          | `MAKEUP`                 |          1 to many | Origin enrollment for visiting student.                  |
| `CLASS_SESSION`       | `MAKEUP`                 |          1 to many | Target session for makeup visit.                         |
| `PAYER`               | `ORDER_RECORD`           |          1 to many | Billing party places orders.                             |
| `ORDER_RECORD`        | `ORDER_BENEFICIARY`      |          1 to many | Order covers students.                                   |
| `STUDENT`             | `ORDER_BENEFICIARY`      |          1 to many | Student is beneficiary.                                  |
| `ORDER_RECORD`        | `INSTALLMENT`            |          1 to many | Order payment schedule.                                  |
| `INSTALLMENT`         | `INSTALLMENT_ADJUSTMENT` |          1 to many | Signed adjustments.                                      |
| `PAYER`               | `PAYMENT_ENTRY`          |          1 to many | Money received from payer.                               |
| `PAYMENT_ENTRY`       | `PAYMENT_ALLOCATION`     |          1 to many | Entry split across installments.                         |
| `INSTALLMENT`         | `PAYMENT_ALLOCATION`     |          1 to many | Installment receives allocations.                        |
| `USER`                | `GENERATED_ARTIFACT`     | 1 to many optional | Requested by staff.                                      |
| `STUDENT`             | `GENERATED_ARTIFACT`     | 1 to many optional | Student-scoped artifact.                                 |
| `SCHOOL_CLASS`        | `GENERATED_ARTIFACT`     | 1 to many optional | Class-scoped artifact.                                   |
| `ORDER_RECORD`        | `GENERATED_ARTIFACT`     | 1 to many optional | Order-scoped artifact.                                   |

## Excluded From MVP ERD

- Better Auth adapter tables: owned by Better Auth, not the domain model; do not use UUIDEntity.
- `FinanceSettings`: singleton row (`id = "singleton"`), not a UUIDEntity; see [D-0034](./decisions.md#d-0034-uuidentity-base-for-all-domain-tables).
- `CollectionAttempt`: P1 (`S-FIN-4`), intentionally no P0 table.
- `doNotContact`: P1 (`S-NOT-4`), intentionally no P0 field.
- Leads/CRM, expenses, WhatsApp/Evolution, payment processing, Cora API import, substitute assignment, grades/assessments, and automated class-generation intelligence.
