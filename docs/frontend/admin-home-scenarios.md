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
| `urgent`: 3 uncovered classes, 5 recent lessons and 2 appointments to record | Coverage and recent records lead; 38 old lessons and 3 old appointments stay separate. | Open coverage and a recent-record group; the relevant list, count and route/action are visible. |
| `admissions`: 7 placement results and 14 leads needing a class | Admission work has clear next steps without displacing urgent teaching work. | Open placement and allocation groups; each shows its own people and count. |
| `semester`: 12 unpublished allocations, 9 first contracts, 6 renewals | The three queues stay distinguishable and the next action is clear. | Open each queue; destinations match organization, student, or finance context. |
| `quiet`: active school, zero queues, one ordinary agenda item | Useful school and month context takes priority. There are no large reserved empty regions or repeated zero metrics. | Open agenda; one item is shown and the overview remains useful. |
| `new`: `school.totalStudents = 0`, zero school and business series, zero queues and history, no agenda | A compact first-use state gives a concrete route to start setting up the school. Students who are inactive still count toward `totalStudents`, so their school does not enter this state. | Follow its primary action; it must lead to a usable setup route. |
| `no_finance`: home response omits finance groups and the isolated tab overrides `AdminHome.finance` to `false` | School indicators and chart replace finance; no finance queues, business content, or blank gap. | Confirm `dashboard.business` is disabled (`fetchStatus: idle`) and no business request fires. The hook keeps one observer. This is a controlled UI state: currently every role that renders AdminHome also has finance access, so a real no-finance session is unavailable. |
| `busy`: 12 remaining events of mixed kinds, one uncovered class | The agenda preview remains bounded and shows an overflow link; teaching priority is still clear. | Open agenda; all 12 events are reachable. |
| `stress`: counts above 1,000, long names, 1,204 agenda events | Counts use pt-BR grouping and names wrap without covering actions. | Inspect narrow and desktop layouts and open a group. The agenda headline grouping issue found in this scenario has been corrected. |
| `loading`: both queries pending, then resolve independently with `set("home", data)` or `set("business", data)` | Each area loads or resolves on its own. | Resolve home while business remains pending, then reverse the order; no layout jump hides an available action. |
| `business_error`: only financial query errors | School work and agenda remain usable; finance has its own retry. | Retry finance; school state remains available. |
| `home_initial_error`, `home_error`: initial home error and stale refresh error | Initial failure has a useful retry; stale failure keeps the last known school content with an error notice. | Retry home; only the affected query changes. |
| `detail`: pending, empty, error, recent/history, pagination | The table has a distinct state for each; recent and history totals remain separate. | Open lessons, switch history, advance page 1 to 2, and inspect the table states and return action. |
| Month selector: choose September 2026 while today is October 23 | School and business indicators use September; agenda and pending work still reflect today. | Select September in the UI; confirm both indicator query months are `2026-09` while `home.today` and agenda remain current. |

The first pass against the current composition reproduced both-query loading, independent
resolution, urgent work, quiet and new schools, stress counts and long-name detail, finance-only
failure, initial and stale home failures, and controlled `no_finance`. At 1120 and 1440 pixels the
stress detail had no horizontal overflow. In `no_finance`, the business query had one disabled
observer (`fetchStatus: idle`), no business request, and no visible finance content. Screenshots
are in `/tmp/lazuli-home-scenarios/` (`loading-1120.png`, `urgent-1120.png`,
`no-finance-1440.png`). After the final UI changes, the truly empty school showed only the
first-use panel and primary “Começar pelos alunos” action (`new-final-1120.png`); loading at
1120 had no horizontal overflow; and a ten-row detail fit within a 900px viewport without
internal table overflow, with KPIs and agenda hidden. Empty and error detail states rendered
their expected messages. Selecting September in the real UI kept the agenda on October 23.
The first-use primary action initially surfaced a Base UI console warning because its `Button`
rendered a Link with `nativeButton=true`. After `nativeButton={false}` was added, the `new`
scenario rendered with `school.totalStudents = 0`, a link to `/alunos`, and no recurrence of
that warning. Visual acceptance and a real non-finance permission assertion remain open.
