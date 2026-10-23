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
| `new`: zero students, zero queues and no agenda | A compact first-use state gives a concrete route to start setting up the school. | Follow its primary action; it must lead to a usable setup route. |
| `no_finance`: home response omits finance groups | No finance queues or blank gap. | In a **non-finance authenticated session**, confirm no `dashboard.business` request, finance section, or finance navigation. Clara's server-rendered finance permission prevents full validation with this runner. |
| `busy`: 12 remaining events of mixed kinds, one uncovered class | The agenda preview remains bounded and shows an overflow link; teaching priority is still clear. | Open agenda; all 12 events are reachable. |
| `stress`: counts above 1,000, long names, 1,204 agenda events | Counts use pt-BR grouping and names wrap without covering actions. | Inspect narrow and desktop layouts and open a group. The agenda headline grouping issue found in this scenario has been corrected. |
| `loading`: both queries pending, then resolve independently with `set("home", data)` or `set("business", data)` | Each area loads or resolves on its own. | Resolve home while business remains pending, then reverse the order; no layout jump hides an available action. |
| `business_error`: only financial query errors | School work and agenda remain usable; finance has its own retry. | Retry finance; school state remains available. |
| `home_initial_error`, `home_error`: initial home error and stale refresh error | Initial failure has a useful retry; stale failure keeps the last known school content with an error notice. | Retry home; only the affected query changes. |
| `detail`: pending, empty, error, recent/history, pagination | The table has a distinct state for each; recent and history totals remain separate. | Open lessons, switch history, advance page 1 to 2, and inspect the table states and return action. |

The runner reproduced the real, urgent, admissions, semester, quiet, new, busy, stress,
loading, finance-only failure, initial home failure, stale home failure, and drilldown table
states in its own Orca tab. Those checks exercised the intermediate direction before the latest rapid shell redesign;
they do not validate the latest composition. Visual acceptance, loading refinement, the
non-finance analytical composition, and the non-finance permission assertion remain open.
