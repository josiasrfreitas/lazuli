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
