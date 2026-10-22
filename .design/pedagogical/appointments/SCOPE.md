# V6 — Pedagogical appointments, absence follow-up and attendance

Issue #184, child of #156, under the user's authorization for autonomous implementation in the integrated branch. The choices below resolve the remaining V6 questions for product review; they are not claims of acceptance of discarded workshop hypotheses.

## User work and domain

Administration finds unaddressed absences, records contact with the student/responsible adult, schedules a pedagogical appointment and follows its completion. A teacher sees their dated appointments and records attendance and actual content. The student profile explains original attendance, compensated time and remaining absences.

A Pedagogical Appointment has one student and an explicit purpose: MAKEUP (absence replacement), PPT_COMPLEMENT, REINFORCEMENT or ASSESSMENT. It can use a dated class encounter as a guest, or its own teacher/date/time. A Makeup is specifically the absence-compensating purpose, not a synonym for every appointment. Multiple students can attend the same existing class through separate appointments. New independent appointments have one student each; no group-session administration is introduced.

## Scheduling and responsibility

- Administration schedules, cancels and reschedules. A future time later today is valid. Dated class guests use the encounter's own time, format and responsible teacher, including substitutions. Independent appointments choose those fields explicitly.
- Validate active teachers on the date, school closed days, teacher commitments (classes, substitutions, introductions and other appointments) and the student's existing commitments. Appointment scheduling shares the existing teaching-schedule lock. Teacher assignment/class/introduction writes also consider independent appointments, so conflicts are not one-directional.
- PPT complement requires the student's dated PPT enrollment. Other purposes can reference an enrollment for context; absence origins remain attached to their original enrollment even after a pause, return or semester change. No enrollment, grade, progress, contract or fee is created by scheduling/completing an appointment.
- A guest appointment cannot complete if its destination class was cancelled. Rescheduling cancels the old appointment with a reason and creates a linked successor atomically; old dates, authors and state remain readable. Cancellation releases pending compensation reservations. Completed work uses justified correction instead of rescheduling or erasure.
- Teachers can read their responsible encounters/appointments and record the current São Paulo business day after the end. Administration can complete past records and correct with a reason. Version checks reject stale writes. Important actions carry actor/date and enter the existing activity timeline.

## Absence compensation

- Each coverage points to a real confirmed ABSENT attendance row belonging to the student and earlier than the appointment. Original attendance rows remain untouched. One appointment may cover several absences; an absence may be covered in parts.
- Minutes are the common unit: a 90-minute absence covered by 45 confirmed minutes retains 45 missing minutes. Planned allocations reserve the remaining minutes against duplicate scheduling; they do not increase attendance. Sum of coverages cannot exceed appointment duration when scheduled, or actual teaching minutes when completed. Each absence's pending plus confirmed allocation cannot exceed its original duration.
- The completion form permits adjusting planned coverage to actual delivery. A no-show or cancellation contributes zero and releases its reservations. Justified corrections may change the result/content/allocation while preserving prior snapshots.
- Frequency is (present teaching minutes + confirmed compensated absence minutes) / confirmed scheduled teaching minutes in the enrollment ∩ semester window. Keep original present/session counts as explanatory data, expose minutes and compensation separately, and retain the existing 75% attention threshold. Empty denominators remain no data. Cancelled/unconfirmed classes are excluded. Support without an absence never enters the denominator or numerator.
- Compensation applies to the source enrollment/semester, even if the appointment occurs later. A later correction of the source to PRESENT cannot double-count compensation; preserve its linked history and surface that its coverage no longer applies. A simultaneous source correction and allocation/confirmation must serialize against the class-record lock.

## Actual content and follow-up

- A completed attended appointment records actual teaching minutes and a brief account, including PPT individual content. Planned content can be suggested from V4's actual source lesson; missing historical content remains unknown. Do not substitute planned pages for actual delivery.
- Assessment appointments schedule and record the teaching encounter only; V7 continues to own scores, recovery and academic confirmation.
- Record absence contacts with student, optional source absence, contact date/time, channel, outcome, concise notes, actor and optional next-contact date. Records are append-only; a new note corrects or develops the prior contact. No automated messages, outreach queue, CRM stages or billing rules.

## Existing data

Existing Makeup identifiers and their attendance/cancellation evidence are preserved. Introduce linked appointment records for historical makeups without inventing a missing absence source, actual content or actor. Imported completed appointments lacking source coverage contribute zero compensation until administration explicitly associates verified origins through a justified correction. Existing legacy API entry points must use the same V6 source/allocation and outcome rules, not bypass them. The realistic seed supplies known origins from the original selection algorithm rather than parsing prose.

## Composition and implementation

Considered (1) adding every task to the student profile, (2) mixing appointments into the class-only agenda, and (3) an Atendimentos workspace with Agenda and Faltas views, contextual student links and a compact section on the student profile. Select (3): it supports the administration's cross-student follow-up and the teacher's own agenda without turning a student's page into a scheduling desk. Reuse the DS forms, filters, operational table and existing editorial/navy design. The teacher's week includes independent appointment time without double-counting guests in classes.

Implement model/rules and persistence, then scheduling/recording/follow-up UI, then integrated seed and browser validation. Cover partial/multiple compensation, no-show/cancellation/reschedule, source corrections, concurrency, role/date scope, conflicts and separation from grades/finance with useful automated cases. Do not run local suites, lint, typecheck or build per user; validate actual browser workflows and retain commit hooks.

Seed target: preserve 250 students; enrich the five known class-guest makeups, include 45+45 partial coverage, one 90+30 multiple-absence case, cancelled/rescheduled, no-show, PPT complement, reinforcement, assessment and about 14 attributed contacts. No fabricated student histories or renamed identifiers.
