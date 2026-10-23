# Admin home scenario review

Use these states while comparing home directions. The working disposable runner is
`/tmp/lazuli-home-scenarios/run.sh`; it changes only the isolated Orca tab's in-memory tRPC
query state and browser fetch responses. It does not write PostgreSQL or product source.
The example people carry `Cenário:` and `Exemplo ilustrativo` labels; their broad destination
routes are real, but their identities and counts are illustrative. A reload restores real data.

Run `LAZULI_SCENARIO_PAGE_ID=<Orca page id> sh /tmp/lazuli-home-scenarios/run.sh init`, then
the same command with a scenario name. Use `restore` when finished. Keep the page id explicit
because another agent may use the active tab. This runner assumes the admin home is already
mounted and authenticated. For drilldowns, select a group after running `detail`; new pending
queries receive paginated illustrative responses. `window.__lazuliHomeScenario.set("pending",
undefined, "pending" | "error")` changes the active table state; use `{total:0,items:[]}`
for empty. Select “Histórico anterior” and “Próxima página” for pagination.

| State / trigger | Visible result | Action and assertion |
| --- | --- | --- |
| `real`: authenticated Clara home | Actual mixed data, including old lesson history separated from today's work. On 2026-10-23 the seed showed 230 students, 10 without a class, 10 first contracts, 618 old lesson records, and no remaining agenda. | Open old lesson history. It must not be presented as today's urgent work. |
| `urgent`: 3 uncovered classes, 5 recent lessons and 2 appointments to record | Coverage leads the pedagogical queue; recent records follow. The 38 old lessons and 3 old appointments stay in separate history links. | Open coverage, both recent-record groups and both history links; each detail opens and returns to the overview. |
| `admissions`: 7 placement results and 14 leads needing a class | Admission work has clear next steps without displacing urgent teaching work. | Open placement and allocation groups; each shows its own people and count. |
| `semester`: 12 unpublished allocations, 9 first contracts, 6 renewals | Allocation leads the pedagogical queue. Contracts and renewals appear as secondary management tasks. | Open each queue; destinations match organization, student, or finance context. |
| `quiet`: active school, zero queues, one ordinary agenda item | Useful school and month context takes priority. There are no large reserved empty regions or repeated zero metrics. | Open agenda; one item is shown and the overview remains useful. |
| `contracts_only`: no pedagogical pending work, 9 first contracts | A short no-pedagogical-pendency line replaces the queue. The contract action remains in management; no empty task card or agenda column is reserved. | Open contracts and return; its detail shows 9 illustrative items. |
| `student_contract_overlap`: the same 10 illustrative students have no class and a first contract | Students appear once in the pedagogical priority and contracts once in management; the home does not sum them into a misleading 20-person total. | Open both details and return; each shows 10 items with the same illustrative identities. |
| `new`: `school.totalStudents = 0`, zero school and business series, zero queues and history, no agenda | A compact first-use state gives a concrete route to start setting up the school. Students who are inactive still count toward `totalStudents`, so their school does not enter this state. | Follow its primary action; it must lead to a usable setup route. |
| `no_finance`: home response omits finance groups and the isolated tab overrides `AdminHome.finance` to `false` | School indicators and chart replace finance; no finance queues, business content, or blank gap. | Confirm `dashboard.business` is disabled (`fetchStatus: idle`) and no business request fires. The hook keeps one observer. This is a controlled UI state: currently every role that renders AdminHome also has finance access, so a real no-finance session is unavailable. |
| `busy`: 12 remaining events of mixed kinds, one uncovered class | The agenda preview remains bounded and shows an overflow link; teaching priority is still clear. | Open agenda; all 12 events are reachable. |
| `stress`: counts above 1,000, long names, 1,204 agenda events | Counts use pt-BR grouping and names wrap without covering actions. | Inspect narrow and desktop layouts and open a group. The agenda headline grouping issue found in this scenario has been corrected. |
| `loading`: both queries pending, then resolve independently with `set("home", data)` or `set("business", data)` | Each area loads or resolves on its own. | Resolve home while business remains pending, then reverse the order; no layout jump hides an available action. |
| `business_error`: only financial query errors, with 2 recent lessons, 4 students without class, 3 contracts and 2 renewals in the home response | Pedagogical work and its older lesson history remain usable. The management summary shows an error and retry while keeping contract and renewal actions sourced from the home response. | Open the pedagogical and financial tasks and return; the business error must not hide them. |
| `home_initial_error`, `home_error`: initial home error and stale refresh error | Initial failure has a useful retry; stale failure keeps the last known school content with an error notice. | Retry home; only the affected query changes. |
| `detail`: pending, empty, error, recent/history, pagination | The table has a distinct state for each; recent and history totals remain separate. | Open lessons, switch history, advance page 1 to 2, and inspect the table states and return action. |
| Month selector: choose September 2026 while today is October 23 | School and business indicators use September; agenda and pending work still reflect today. | Select September in the UI; confirm both indicator query months are `2026-09` while `home.today` and agenda remain current. |

In the pedagogical-first composition, the final synthetic pass checked `real`, `urgent`,
`admissions`, `semester`, `quiet`, `no_finance`, `contracts_only`,
`student_contract_overlap`, and `business_error` at both 1120 and 1440 pixels. None had
horizontal document overflow. Coverage, lessons, placement, and semester allocation became
the first priority in their respective states. The quiet and contracts-only states used one
compact line instead of an empty queue card. A separate action smoke opened and returned from
all 17 positive groups in these states and both older-history links. `business_error` retained
the pedagogical queue and home-sourced contract and renewal tasks beside the finance error.
The overlap state displayed 10 students and 10 contracts in their respective contexts, without
claiming 20 distinct people. At both widths, simultaneous home/business loading fit the page;
at 1440, resolving either query while the other remained pending revealed its content
independently. Screenshots: `/tmp/lazuli-home-scenarios/urgent-pedagogy-1120.png`,
`quiet-pedagogy-1120.png`, `contracts-only-1120.png`, and `loading-pedagogy-1120.png`.

Earlier synthetic passes covered the truly empty `new` school, 10-row pending detail layout,
empty/error detail states, stress counts and long names, busy agenda, initial/stale home errors,
and September month selection. Those were not repeated after the pedagogical-first composition;
their prior evidence is in `/tmp/lazuli-home-scenarios/`. The prior `new` pass confirmed the
first-use panel and `/alunos` action after `nativeButton={false}` removed its console warning.
The current finance-permission check remains controlled by an in-memory prop override: the
business observer was idle, with no request or visible financial content, but there is no real
non-finance admin session to assert RBAC end to end. All illustrative detail navigation checks
exercise UI state and mocked responses, not persisted records or actual destination mutations.
The owning agent separately followed the real students-without-class queue to a student profile
and opened continued registration without saving changes. September selection kept the ten
current students in triage while switching school indicators and the six-row values table to
September; the main tab was restored to October.

A transient Next.js “Transition was skipped” issue badge appeared while the runner switched
React states rapidly. The home now handles the expected `AbortError` from a superseded visual
transition. A real detail/open-return sequence completed with no unhandled rejection after that
fix. A reload of the isolated scenario tab also returned its issue count to zero.

## Temporal priority review

These illustrative fixtures add optional `HomeItem.timing` values. They take `today` from the
actual `dashboard.home` response and set the synthetic response's `updatedAt` to 14:30 on
that São Paulo school date. Thus “in progress,” “today,” and waiting ages have a stable
reference within the payload; browser wall time does not decide their order. Counts and people
remain illustrative. Run `init` after the API/UI change is mounted, then each named scenario.

| State / trigger | Visible result | Action and assertion |
| --- | --- | --- |
| `coverage_now`: uncovered meeting today, 14:00–15:00, plus three students without a class | At the 14:30 snapshot, the uncovered meeting leads with an explicit in-progress time cue. | Open coverage, verify its meeting and time, return; no other queue displaces the live class. |
| `coverage_today`: uncovered meeting today, 18:00–19:00, plus three students without a class | Today's class leads with a today/time cue, distinct from an already-running meeting. | Open coverage and return; the detail date matches the preview. |
| `entry_tomorrow_vs_coverage_six_days`: one semester allocation with first entry tomorrow and one uncovered meeting in six days | The tomorrow entry leads despite the old static coverage-first order; the six-day class stays reachable. | Open both groups and return; confirm tomorrow and six days use the payload's school date. |
| `entry_overdue`: semester allocation with first entry yesterday and uncovered meeting tomorrow | The passed entry date leads and names the need to revise dates without implying that the meeting is already late. | Open both groups and return; check dates and no invented combined count. |
| `placement_wait_old`: placement waiting eight days and uncovered meeting in five days | The wait crosses the seven-day threshold and receives a clear aged-work cue; compare its prominence with the future class. | Open placement and coverage, verify the eight-day wait and five-day date, return. |
| `placement_wait_recent`: placement waiting two days and uncovered meeting in five days | The recent wait receives a milder cue than the eight-day state; there is no overdue language. | Compare with `placement_wait_old`; open both details and return. |
| `allocation_wait_known`: allocation waiting five days and one student without a class with no deadline | Known wait duration is visible; undated student work stays reachable without a fabricated date. | Open allocation and students, confirm only allocation has a waiting timestamp. |
| `students_no_deadline`: one student without a class and one semester allocation, neither with `timing` | Both tasks remain reachable under the ordinary fallback ordering; neither gets a false time cue. | Open both groups and return; no empty slot or zero metric appears. |
| `quiet`, `no_finance`, `loading`, `home_initial_error`, `business_error` | Existing empty, permission, independent loading and error states remain legible with the temporal ordering. | Recheck 1120 and 1440 widths, disabled business query in `no_finance`, and home-sourced tasks under finance error. |

The final synthetic pass rendered these states at 1120 and 1440 pixels without horizontal
overflow. `coverage_now` was `ongoing`/destructive with its 14:00–15:00 interval; the later
class was `today`/warning. The tomorrow semester entry led the class in six days, and the
passed entry date led tomorrow's class with a date-revision action. An eight-day placement
wait led a class in five days; a two-day wait did not and was labeled as awaiting follow-up,
without an invented deadline. Allocation showed its known five-day wait while undated student
work stayed neutral. The quiet state reserved no empty task card. In `no_finance`, the business
query stayed pending/idle with no request and no visible finance section. A finance-only error
left the pedagogical priority and home-sourced contract and renewal actions visible. Initial
home failure showed retry while business remained available; stale home failure kept its last
school view. Simultaneous loading fit at both widths; resolving either query first at 1440
showed independent content.

Screenshots: `/tmp/lazuli-home-scenarios/coverage-now-1120.png`,
`entry-tomorrow-1120.png`, `entry-overdue-1440.png`, and `loading-temporal-1120.png`.
This pass asserted visible state and queue order; it did not repeat all route clicks or verify
persisted data. The single-item priority figure initially used plural nouns (“1 aulas sem
professor” and “1 alocações a publicar”); the follow-up composition corrected both.

The scoped follow-up checked `coverage_now`, `entry_tomorrow_vs_coverage_six_days`, `busy`,
`stress`, and both-query loading at 1120 and 1440 pixels. Every state fit the viewport. With
an agenda, it occupied the column beside the main priority while secondary workstreams used
the full width beneath; the busy and five-secondary-group stress states left no empty column
under the agenda. The one-item figure read “1 aula sem professor” and “1 alocação a publicar”.
Both-query loading remained pending without horizontal overflow. One busy
secondary queue opened its populated detail and returned to the overview. Focus placement
could not be asserted from the isolated background tab (`document.hasFocus() === false`),
although the route and return rendered. Captures: `/tmp/lazuli-home-scenarios/coverage-now-final-1120.png`
and `/tmp/lazuli-home-scenarios/busy-final-1440.png`.

A focused check in the active main tab completed the previously inconclusive keyboard path:
Tab reached “Definir turmas” with visible focus, Enter opened the real ten-row queue, and Tab/Enter
on the return control restored the overview. Both transitions left focus on `#home-work`. This check
found and fixed a race: focus had been scheduled before the asynchronous view-transition callback
committed the new section. Focus is now scheduled after that commit. A direct student preview also
opened the real student profile and its continued-registration entry point. The main tab was restored
to the real October home; no records were changed.
