# Teacher profile implementation evidence

Date: 2026-11-12. Surface mode: Operate. Current user instructions supersede earlier proposal text.

## Delivered behavior

- Four sections: Visão geral, Turmas, Alunos and Cadastro. Identity, email, access status and navigation share one desktop row; narrow desktop uses email/access icons to preserve the teacher name. Student transitions are reused and inactive sections unmount.
- Overview fits 1026 × 720 and 1280 × 720 with the current 22-student fixture, without vertical scrolling or clipped actions. Mobile stacks the containers and scrolls normally.
- Gold metric icons and subtle rules, neutral navigation icons, green/yellow/red health bands. Overview order is Saúde / Acompanhamento, then Aprendizagem / Frequência. Follow-up previews one occurrence at a time with student, status, title, bounded excerpt, open/intervention totals and a record link; it reuses the class inactivity/reduced-motion rotation.
- Health information dialog shows the actual sum and denominator, score bands, all four existing domain weights, missing-data examples and scope limitations. It uses the existing student score, not a new teacher effectiveness formula.
- Calls count each eligible class session once (58 confirmed of 77 in the fixture), separately from per-student attendance denominators. Class detail exposes its own confirmed/due counts.
- Students are grouped by current class in individual background/border cards with avatars, individual scores, grades, absences and open occurrences. Search filters names without additional requests.
- Dated agenda includes classes, appointments and experimental lessons. Leading/trailing unused hours are trimmed; a ready empty period retains navigation but omits the time grid. Scroll chaining into the containing page is enabled.
- Registration retains student-style facts and one document preview, a horizontal label/icon strip, compact attachment editor and teacher photo in the header when available.

## Checks executed

- `node --import tsx --test packages/api/test/teachers/metric-rules.unit.test.ts packages/api/test/teachers/metrics-attendance.unit.test.ts`: 5 passing tests. Attendance test rerun after class-level call changes; verifies two enrollments do not multiply class calls, exclusions, missing attendance and capped compensation.
- Named changed files formatted with oxfmt; `git diff --check` clean.
- Orca browser: actual metrics endpoint; desktop and 390px layouts; light/dark token rendering; rapid section switching; one mounted panel; no unhandled transition rejection; reduced-motion switch; keyboard modal close restores trigger focus.
- Orca browser: health dialog actual arithmetic and weights, mobile dialog layout; student groups and search control; class/date navigation, substitution dialog, empty Sunday agenda; wheel over the agenda advanced the page scroll to 198.5px, with vertical overscroll computed as auto.
- Orca browser: empty document states, horizontal strip and labeled attachment editor. No document was uploaded/deleted to fabricate validation data.

## Limits and deferred gates

- Full lint, typecheck, build, integration and transport suites are deferred to delivery/CI, per the repository guide and user memory constraint. No extra server or agent was started.
- Uploaded photo/PDF success, camera and QR transfer were not exercised with new files. Existing private transport is preserved; header reflects available teacher photo metadata.
- Grade attribution across real transfers and ambiguous assessments was reviewed in code; the current browser fixture contains no eligible grades. No fabricated evolution/history is shown.
- Student health still excludes outside-class occurrences, as in the existing student implementation. Follow-up includes them; the information dialog explicitly explains the distinction.
- A class with daytime and evening events retains the continuous time axis between them. Only unused leading/trailing hours are trimmed.

## Follow-up polish checks

- Orca at 1280×720 and 1026×720: all four overview blocks fit. At 1026px, main clientHeight and scrollHeight are both 664px, and header clientWidth and scrollWidth are both 803px.
- Student cards inspected at 1026px and 390px: distinct background/borders, no card horizontal overflow; mobile stacks cards and scrolls the tab strip.
- Class roster action column reserves icon plus padding, removing the small desktop overflow. Menu and stacked membership dialog inspected at desktop and 390px.
- Membership confirmation browser checks: partial name remains disabled; full name enables the action; Enter with missing date reports the validation error; both pause/end labels update; cancelled without changing enrollment.
- Class empty occurrences/performance are centered with light copy. Empty planning exposes its start action and omits empty view buttons.

## Overview height and reading refinement

- Desktop header uses a left-aligned identity/contact cluster and right-aligned navigation, without equal-width spacing between teacher facts.
- Desktop overview consumes the available tab height. At 1280×720 and 1026×720, top cards are approximately 321px and lower cards 187px, with no overview/page overflow in the current fixture.
- Health adds a link to the lowest-scoring student in attention/priority plus coverage of partial or missing indicators. No score calculation changes.
- Follow-up uses the class reading-panel treatment, student/date/status, category, longer bounded report, optional immediate response, author and existing rotation controls. The full record remains accessible by link.
- Current occurrence fixtures have no immediate response, so that conditional content was inspected in code rather than validated through a new persisted record.
- Browser briefly failed to load development chunks with HTTP 502 after a local runtime interruption; reloading the existing tab restored the live data. No server was restarted by this task.

## Loading refinement

- Replaced oversized follow-up and health placeholders with avatar, identity, status, report lines, author and footer geometry using InlineSkeleton. Numeric/header placeholders use block shapes.
- One transform-only diagonal sweep follows the operational-table loading treatment; data enters with the existing 180ms opacity/easing tokens. Reduced motion disables the sweep and entrance, and existing skeleton pulses already respect that preference.
- Orca inspection held real read responses only inside the owned browser tab, then released them and restored fetch. Confirmed skeleton dimensions (12–20px text/status bars, 32px avatar), running sweep, desktop/mobile layout and normal data arrival. No artificial delay was added to application code.
- Fixed header loading width so its email placeholder cannot push navigation outside the viewport; measured header clientWidth/scrollWidth both 1185px at 1280×720.

## Attention, student directory and substitution refinement

- Removed the overview's student/class/semester/date summary line as requested. Health now shows up to three students in attention/priority, ordered by lowest score, under “Para acompanhar de perto”. Desktop uses compact adjacent links; mobile stacks them.
- Orca inspected the actual Rafael fixture (33 students, three attention scores of 69) at 1026×720 and 390×844. Desktop main and panel clientHeight equal scrollHeight (664px and 575px); the health action remains inside its card. Mobile has no horizontal page overflow.
- Student directory header now combines title/count, search and score order, without the explanatory paragraph. Class separators use the neutral border token. Browser verified ascending and descending scores within all three classes, plus name filtering to one student; missing scores remain last in either direction by the comparator's explicit null handling.
- Agenda explains one-date substitution and consumes the existing authoritative meeting editable flag. Browser verified that a past event opens no dialog and a future event opens the substitute selector; dismissed without saving. The separate “Pendências de docente” entry point remains available for uncovered meetings.
- Renamed the remaining absence rate to “Faltas não compensadas” and clarified its detail: only attended makeup minutes linked to an absence are deducted; scheduling alone does not compensate it. The calculation is unchanged.
- Targeted formatting and git diff --check passed. Full lint, typecheck and test/build suites remain deferred to the delivery gate or CI.

## Health distribution and teacher avatar

- Replaced the gold divider with a 3px proportional SVG bar: success, warning, destructive and a neutral segment for insufficient data. Zero-count bands draw no segment; loading/empty states keep a neutral track. Accessible text names every count.
- Orca confirmed the 22-student fixture draws exactly 21/22 green and 1/22 yellow, with no red segment. Desktop and 390px layouts retain the available width without horizontal overflow.
- Teacher avatar uses the student's 40px photo trigger, 1.85× hover/focus expansion and image dialog styling. Header spacing accommodates the expanded avatar and shifted name. The loading avatar matches the new size.
- Desktop checked at 1026×720 with three attention students: main and health card have equal client/scroll heights. Focus expansion measured 74px, with the name shifted 8px and no overlap.
- Profiles inspected have no uploaded photo, so the fallback expansion was exercised; the real-photo dialog path was reviewed in code but not exercised with a new upload. No files were uploaded for validation.
- Targeted formatting and git diff --check passed; full delivery checks remain deferred.

## Class comparison and agenda switch

- Accepted direction: the teacher's Turmas section opens a Turmas / Agenda segmented control, defaulting to the class comparison. View and ordering live in the URL. The dated agenda and one-date substitution flow remain available in Agenda.
- Current-class cards expose student count, mean student score and coverage, mean grades, absence percentage before makeup compensation, and confirmed/due class calls. Actual attention and priority counts use separate semantic badges. The selected comparison metric receives a restrained gold emphasis.
- Ordering supports lowest score, lowest grade average, highest absence rate and class name. Missing metrics follow measured values, including zero; equal metrics use Portuguese numeric name ordering. All teacher assignments remain reachable through the collapsed Todos os vínculos section.
- Orca inspected real Rafael data at 1280×720 and 390×844. Cards have distinct surfaces and no horizontal overflow (390px document client/scroll width; 356px card client/scroll width). Exercised all four order options, the assignment disclosure, keyboard view switching, class navigation/back links and the future-class substitution dialog, dismissed without saving.
- An isolated Node check of the actual sorting helper passed hand-authored expectations for zero, nulls, tied numeric names, descending absence order and unchanged input. Current fixtures have no eligible grades; the empty-grade display was inspected in the browser and numeric grade ordering in the isolated check.
- Targeted files formatted and reviewed; git diff --check passed. Full lint, typecheck, build and repository test suites remain deferred to delivery/CI.

## Direct controls, photos and registration follow-up

- Replaced the class-order selector with separate Score, Notas and Faltas buttons. The selected button is highlighted; repeating a click reverses ascending/descending direction. Removed name ordering. Regular/PPT are alternative type filters; attention/priority can combine with either. Clearing filters preserves ordering. All state stays in the URL.
- Filters and ordering share one desktop row without visible group labels. Orca confirmed equal 140px top positions at 1280px; 390px wraps the groups and retains equal document client/scroll widths. Exercised filter combinations, no-result recovery, active button state, and both score directions. Isolated checks passed all six numeric orderings, null-last/zero handling, numeric-name ties and type/attention intersections.
- The single flagged student in the health summary now has avatar/name on the same row and score at right. The primary teacher absence rate stays raw; the adjusted secondary rate and detail column were removed. Other compensated calculations are inventoried in ATTENDANCE_AUDIT.md and remain unchanged.
- Extracted the existing student photo view for shared teacher/student behavior. The teacher avatar opens even without an image and offers upload/replacement through the existing private teacher-files route. Student upload/processing logic and limits are unchanged. Browser checked empty viewers and file-input affordances on both profiles, plus Escape close. No new photo was persisted; real upload success was not exercised.
- Entire student cards link to the student profile, including clicks on metric areas. Browser verified the actual destination and continued student photo behavior.
- Teacher registration omits PHOTO from its attachment section, leaving the header avatar as the entry point. Desktop information and attachments measured exactly 564×432.5px each. Narrow registration stacks the containers.
- Registration skeletons use the student's InlineSkeleton and student-loading surface sweep, shaped for teacher facts and attachment rows. A real files response was temporarily held only in the owned browser tab: confirmed the student-loading sweep in the attachment state and normal arrival after release. Fetch was restored. Initial full-page loading composition was reviewed in code; its whole pending state was not held successfully in the browser.
- Changed files formatted, complete relevant changes reviewed, and git diff --check passed. Full static/test/build gates remain deferred to integration/CI under AGENTS.md.
