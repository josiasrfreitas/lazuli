# Teacher workspace handoff — 2026-10-19

This local implementation addresses [issue #191](https://github.com/josiasrfreitas/lazuli/issues/191): teachers perform their assigned pedagogical work on mobile, with desktop access retained. This record describes implementation choices and available evidence; it does not declare every acceptance criterion complete or every parameter approved during grooming.

## Experience and incumbent system

The final agenda follows the owner's correction: the teacher uses the same calendar composition as administration, through `TeacherAgenda` → `ClassAgenda` → `LessonCalendar` → shared `ScheduleCalendar`. It is not a separate teacher calendar. Mobile opens in day view with collapsed filters. Teacher navigation exposes Agenda, Turmas, Alunos and Acompanhar, with a persistent pending-record notice. The mobile search trigger shows a magnifying-glass icon and **Buscar**; desktop shows **Buscar** with the **⌘ + K** shortcut badge.

This is an ordinary extension of the incumbent visual system. Source comparison covered `docs/frontend/README.md`, `packages/ui/src/styles/globals.css`, teacher navigation, agenda and assessment attachments. The implementation consumes existing semantic surface, border, text and interaction tokens, shared controls and the shared calendar. Compact groups, responsive field grids, contextual dialogs and lower-emphasis secondary actions continue the existing operational language. No new visual world, token catalog or design-system rewrite is required. Incumbent system files are preserved by this documentation pass.

The finish reviewer reported **ship** for ten captures in [the review directory](../../.impeccable/review/teacher-workspace/): agenda at 1440×900 and 390×844, plus mobile planning, proof attachments, follow-up, grades, diary, QR, placement and appointment views. No material fixes were requested within that captured scope. The reviewer did not independently exercise runtime; this is bounded visual evidence, not full acceptance of every state.

## Implemented boundaries

- **Identity and authority:** one account can hold ADMIN and TEACHER, switching active context through the avatar. Teacher context is scoped on the server to current/assigned students, assigned encounters including substitutions, and the teacher's own historical records. SYSTEM_ADMIN remains separate. Scheduling, rescheduling, cancellation and candidate commercial management remain administrative.
- **Diary:** first registration of a responsible teacher's past lesson has no maximum lateness limit. Already closed historical corrections remain administrative; appointment same-day execution rules remain unchanged. Final attendance and actual delivered content save atomically, with individual content for PPT. Planning is not automatically treated as delivered content, and omitted attendance remains PENDING.
- **Anonymous attendance:** one declaration per browser per encounter survives QR regeneration. This relies on browser storage and good faith, not physical-device identification. In-person windows last five minutes and require the configured school geofence and sufficient accuracy. Online windows offer 10/20/30 minutes without GPS. All windows stop at encounter end; regeneration revokes the previous student token. Opening is restricted to the same school day, from 30 minutes before the encounter through its end. Student declarations remain evidence for teacher review.
- **Projection:** a separate capability displays QR/instructions without a roster or staff session, and follows regeneration. It does not grant teacher controls.
- **Academic proofs:** optional JPG/PNG/PDF files, up to 20 MB each and 20 files per Unit 1, Unit 2 or Recovery phase. Grades can save without files. An assessment appointment references the same attachment record. Rejected files can leave the visible queue without deleting the record; withdrawal requires a reason.
- **Transfers and processing:** a user-scoped IndexedDB queue retains local files; XHR reports transfer progress. Navigation can continue during upload. After browser suspension, recovery requires explicit resumption; this is not an offline or uninterrupted-background guarantee. Private S3 objects use opaque keys, with metadata and authorization in PostgreSQL under [ADR 0025](../decisions/0025-use-aws-for-managed-infrastructure.md). Worker processing validates file signatures/size and computes SHA-256; RECEIVED records support recovery.
- **Candidate placement:** remains a separate domain and its existing 5 MB upload path. The new academic background queue does not cover placement files.

These parameter choices resolve implementation seams that grooming left open; they must not be described as if grooming had explicitly approved every value. The owner must configure the school's actual location before real in-person use. Synthetic coordinates used in local simulation are not an accepted school location.

## Implementation map

| Concern                                              | Main source                                                                                                               |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Teacher discovery, pending work and assigned visits  | `apps/web/src/features/teacher-workspace/`; `packages/api/src/teacher-workspace/`                                         |
| Shared agenda and responsive calendar                | `apps/web/src/features/class-records/agenda.tsx`, `calendar.tsx`; shared `ScheduleCalendar` in `packages/ui`              |
| Search presentation                                  | `apps/web/src/features/command-palette/command-palette.tsx`                                                               |
| Anonymous declaration, staff controls and projection | `apps/web/src/features/student-attendance/`; `packages/api/src/student-attendance/`                                       |
| Academic queue and attachments                       | `apps/web/src/features/assessment-files/`; `packages/api/src/assessment-files/`; `apps/web/src/app/api/assessment-files/` |
| Server processing and private storage                | `packages/worker-handlers/src/assessments/process-file.ts`; `packages/storage/`                                           |
| Candidate placement                                  | `apps/web/src/features/admissions/placement-assessment.tsx`; teacher workspace visit procedures                           |

## Runtime evidence and limits

The implementing agent reported local Orca browser scenarios on 19 October 2026 covering avatar context switching and teacher navigation; late regular/PPT diary saves, dirty-close protection and pending-count reduction; online anonymous declaration without GPS, regeneration, browser lock, idempotency and projection; final attendance/content save; assessment appointment execution; grades without a proof; follow-up occurrence and intervention evolution saves; regular planning plan/activity saves; and experimental outcome plus assigned candidate placement upload/result.

A valid academic PDF survived tab closure in IndexedDB, was explicitly resumed, and reached RECEIVED while app navigation continued. A one-off invocation of the actual worker handler produced READY with SHA-256; authorized download returned 200 and anonymous access 401. An invalid PDF reached REJECTED through the actual handler, and teacher withdrawal required a reason. This does not prove automatic daemon processing after the owner restarted the development server.

At 390 px, the teacher created a PPT plan through the UI for 1 July–31 December 2026, including an individual objective. Regular planning plan/activity saves were also confirmed. A direct authenticated teacher GET to `teacherWorkspace.student` for an existing database student outside that teacher's scope returned HTTP 404 / NOT_FOUND, “Aluno não encontrado entre suas atribuições.”, without a student payload. This verifies that endpoint/scenario only, not comprehensive authorization coverage.

In-person missing, outside-area and imprecise locations were blocked, and an accurate location passed **using simulated coordinates**. No physical GPS validation is claimed. Guarded database cleanup removed exactly one attendance-settings row matching the school, synthetic coordinates, radius, accuracy and author used for the demonstration. The actual school location must now be configured; historical attendance windows remain.

At 390 px, the queue displayed the rejected file and **Limpar concluídos da fila**. Clicking the action removed the notification; after a subsequent polling period, `details[aria-label="Fila de provas"]` remained absent. No horizontal page overflow was observed. The original invalid-file withdrawal persisted as REMOVED with its reason; a second invalid demonstration file remains REJECTED for inspection. Queue dismissal is distinct from withdrawing the underlying attachment record.

No automated tests, lint, typecheck, static checks or production infrastructure/deployment verification were run for this finish pass, following the owner's instruction. The development server remains owner-controlled. Local browser evidence and screenshot review do not establish production readiness or exhaustive authorization/concurrency coverage.

## Pre-existing documentation drift

`PRODUCT.md` still says student PII remains in Cloud SQL; accepted ADR 0025 instead keeps student records in PostgreSQL and selects AWS/S3 without selecting a managed database service. Its statement that attendance is consultation-only describes the earlier consultation slice and no longer describes the teacher's integrated diary execution. Both discrepancies are reported for owner reconciliation; PRODUCT.md and historical documents were not rewritten here.
