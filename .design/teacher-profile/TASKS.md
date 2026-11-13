# Build Tasks: Individual teacher profile

Date: 2026-11-12. Sources: DESIGN_BRIEF.md, INFORMATION_ARCHITECTURE.md, METRICS.md.
Option A was selected by the user. Implementation is explicitly authorized by the active
goal; continue through these slices without additional phase approvals. Reuse student
transitions and existing tokens. Keep memory use low and run necessary checks serially.

- [x] **Profile navigation and dated agenda:** modify TeacherHeader/TeacherSections;
      place four tabs on the subtitle row, reuse the student section carousel, mount only
      the active panel, and move the dated agenda and class directory into Turmas. Verified date navigation, substitution dialog, deep links and rapid switching. Empty agenda periods omit the grid; unused edge hours are trimmed and scroll chaining is enabled.
- [x] **Student-health container and layout A:** revise TeacherMetrics and its API;
      deduplicate current students, show coverage and health distribution, and preserve
      container dimensions during loading. Verify unequal class sizes and missing data.
- [x] **Learning container and details:** add eligible grade aggregation and DataTable
      breakdowns by book/class/student. Verify responsibility dates, transfers, duplicate
      assessments and student-weighted averages; show evolution only for comparable evidence.
- [x] **Attendance and follow-up containers:** add duration-aware absence/compensation
      readings, coverage and contextual occurrence details using existing domain rules.
      Verify cancelled/unconfirmed sessions, substitutions and missing evidence.
- [x] **Student-style registration documents:** modify TeacherDocumentPanel to use a
      horizontal labeled icon strip and single preview; preserve upload/QR/removal flows.
      Mount one preview at a time and verify loading, long labels and many attachments.
- [x] **Validate the complete profile:** inspect via Orca at desktop and narrow widths,
      including keyboard, reduced motion, errors, empty data and transitions. Inspect the
      complete diff and run git diff --check. Exact exercised scenarios and deferred coverage are recorded in VALIDATION.md. Full lint/static/build gates are deferred to
      delivery/CI; do not run parallel checks or start extra agents.

Separate design-review skill remains optional and is not automatically invoked.

- [x] **Final refinement:** compact desktop overview, three semantic health colors, neutral menu icons, teacher photo, student directory, class-session call counts, scannable follow-up counts and explanatory health dialog.
