---
version: 1
slug: "rc-features-class-records-record-page-tsx-ede66d86"
primary_target: "apps/web/src/features/class-records/class-record-dialog.tsx"
related_targets: []
---

# Individual lesson

## Current direction · 2026-10-16

Mode: Operate. The owner replaced standalone lesson navigation with a consultation modal.
This direction supersedes the page layout and direct-navigation instructions below.

Use separate dialogs for lessons, appointments and experimental visits. A lesson shows basic
meeting information, responsible and usual teachers when different, recorded class attendance,
a link to the class, and guests with attendance and the purpose of their participation. Guest
appointments and experimental visits open their own dialogs. Experimental visits identify the
lead owner; administrative contact and follow-up details keep their existing permission boundary.
All former internal lesson-page links now open the lesson dialog.

In the shared weekly calendar, automatic expansion requires clipped or responsive-hidden content.
Readable cards remain stable. The agenda keeps blue Regular and purple PPT, adds teal Experimental,
and uses terracotta Appointment, with explicit category labels and a compact legend.

Implementation status: updated in source. No automated checks or browser validation were run,
as requested by the owner. Earlier page screenshots and the historical review below do not
validate this modal implementation.

## Lesson-dialog refinement

The owner rejected the initial modal layout and its oversized loading placeholder. The current
composition uses a narrower dialog, a compact date/time header, and paired teacher/class facts.
Students and guests share one readable list: identity and participation purpose on the left,
recorded presence on the right, with a count and presence summary above it. Guests remain explicit
in each row and can be filtered together; longer rosters support name search. Unknown attendance
remains unknown. A student opens their profile; a guest opens the relevant existing dialog.

Initial loading renders short fact placeholders and five representative roster rows. It does not
use the large generic RecordState placeholder. History loading is compact. Automated checks were
not run by request; the Orca tabs reported connection failures, so this refinement has not been
visually validated in the running application.

## Historical page direction

Mode: Operate. Route: /aulas/[id]. Confirmed 2026-10-13.

Consult attendance and covered content; do not take attendance on this page. PPT exposes presence only.
Guests are people outside the roster, either enrolled students with linked appointments or registered
leads with trial visits. Clicking lessons navigates immediately; appointments use the student dialog.
The owner replaced the earlier split-content concept. The lesson header uses the same card pattern
as student and class details, with inline facts, stronger value type, a larger title, and only the
covered page range. The class header uses the same tighter fact rhythm. The shell breadcrumb
handles back navigation. Presence and guests appear side by side when guests exist; otherwise presence
uses the width. Attendance rows order absences, present students, then unknown statuses. The presence
heading stays pinned below the shell while the list scrolls. No automated checks, lint, or test suites
for this task by request.

## Direction contract

THESIS: Attendance is the main readable roster; the covered page range is a fact in the lesson card.
OWN-WORLD: Inherit Lazuli's Cambria, navy/gold identity, semantic state colors, shared buttons and
badges. Use aligned rows and quiet dividers rather than stacked boxed utilities.
STORY: Identify the lesson, scan recorded presence, consult pages, open a guest's existing record.
FIRST VIEWPORT: Shared detail card holds a prominent lesson title and compact inline facts for
date, time, teacher and, for regular lessons, only the covered page range. The shell breadcrumb provides back navigation. The presence
roster and guest list sit side by side; without guests presence uses the full width. Sort attendance
as absent, present, unknown. Pin the presence heading beneath the shell during scroll. PPT exposes
presence only. No primary mutation or QR utility. Unrecorded attendance stays unknown.
FORM: The original split-board sketch (candidate 4, seed fe872dc7, aula-painel.html) is superseded
by the owner's correction to the incumbent detail-card pattern and paired lists. Signature interaction:
direct lesson navigation and contextual appointment dialog. Reuse existing control motion.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Finish review · 2026-10-13

Verdict: ship the corrected desktop lesson surface. The latest lesson-bold and class-bold captures
show larger titles and denser, more legible inline facts in their existing detail cards. The lesson
header still exposes only the covered page range; source inspection confirms its missing-pages fallback
now reads “Páginas não informadas” rather than displaying the content reference. Earlier captures
show no duplicate back action, presence and guests side by side, absence first, the presence title
pinned beneath the shell, and presence using the width when there are no guests. Source inspection
confirms absent-present-unknown ordering and the conditional guest column.

This review used the latest supplied screenshots and source. It did not independently operate the
browser. Automated checks were waived by the owner. The earlier split-content review is superseded.
A root DESIGN.md and its scan-mode sidecar are still absent, so the FINISH documentation condition
remains open; this feature review does not establish or replace the project's visual identity.
