# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Product Purpose

Lazuli manages a single English-language school in Brazil. Its domain vocabulary and boundaries
are recorded in CONTEXT.md and AGENTS.md.

## Operating Context

School operations connect students, classes, lessons and pedagogical appointments. Interface copy
is Portuguese-BR and business time is America/Sao_Paulo.

## Capabilities and Constraints

Lesson consultation opens in a modal from the agenda, class and student histories, and linked
appointments. It includes recorded attendance, teachers, basic meeting facts, the class link,
and guests with their participation purpose. The standalone lesson page has been removed.
PPT lessons expose attendance only on this surface. Lessons, appointments and experimental visits
retain separate dialogs; appointments reuse the student-profile dialog. Experimental visits identify
the lead owner and show further lead context under existing permissions. The owner confirmed this
flow on 2026-10-16; attendance remains consultation-only here.

Student PII remains in Cloud SQL. Existing authorization rules apply to every operation.

## Evidence on Hand

The current implementation lives in apps/web/src/features/class-records and
apps/web/src/features/appointments. Shared components and semantic tokens live in packages/ui.
The existing visual system and docs/frontend/README.md govern interface work.

## Open Decisions

Device usage proportions and quantitative product-success targets are not established here.
