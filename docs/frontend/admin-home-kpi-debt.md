# Accepted debt: canonical KPIs

Status: **explicitly accepted for the administrative home delivery on 2026-10-23; follow-up required**.

The user asked for a broader KPI discussion and a canonical way to handle KPIs in the codebase,
then explicitly accepted delivering the home first and revisiting that model afterward. This is
an intentional delivery shortcut, not a decision that home-specific reporting is the application
standard. Do not extend this approach to another surface without reopening this work.

## What ships now

`packages/api/src/dashboard/home-insights.ts` owns local period and comparison calculations.
`home.ts` composes these reads with the existing financial ledger. The home React components own
metric labels, trend interpretation, visualization, destinations, and permission-dependent selection.
These pieces are deliberately local; they are not a generic KPI registry or shared widget system.

- Receipts count non-deleted payment entries by payment date, including unallocated payments.
- Agreements count non-deleted contracts by agreement date; later cancellation does not erase a sale.
- Overdue is the existing ledger's **current** collectible overdue balance and distinct payer count.
  It is a stock, not revenue or profit, and does not follow the analytical month filter. There is no
  historical overdue series available here, so the UI does not invent a trend or sparkline for it.
- School indicators, shown to every administrator, count student creation in São Paulo civil time, enrollment entry dates
  (including transfers), and attended trial visits. These are not interchangeable with sales.
- Current-month comparisons stop at the same day in the previous month, clamped to its last day.
  Completed months compare with the whole previous month. A zero baseline has no percentage.
- Sparklines show six calendar-month totals, with the selected current month partial. Comparisons
  use equivalent elapsed periods. The main chart shows school entry activity. Financial figures
  remain in a secondary summary with a link to the existing financial reports.
- Permission checks remain on the API. Both currently enabled administrative roles have financial
  access; the no-finance layout is a defensive branch validated with a controlled UI scenario.

## Cost and follow-up

Definitions, presentation and permissions can drift if copied. Home reads currently aggregate up
to six months of selected date/amount fields in application memory; a canonical query layer must
review aggregation and caching at the expected data volume. No historical snapshots, targets,
user-configured layouts, or KPI identity/version contracts were introduced for this delivery.

The follow-up must settle:

1. Business ownership and canonical identity of each KPI: meaning, unit, exclusions, source,
   time basis, as-of behavior, and financial versus operational permission.
2. A consistent period/comparison model, including partial periods, zero baselines, missing data,
   historical snapshots, and whether higher/lower values are desirable for each indicator.
3. One query contract for value, comparison, series, freshness and drilldown; aggregation/caching
   must be shared without coupling pure domain rules to UI or persistence.
4. A presentation contract for labels, formatting, status meaning, charts, accessibility, loading
   and partial errors. Do not infer a target or health score from an unlabeled count.
5. Migration of the home to that contract and parity checks against the source reports before
   another surface reuses these indicators.

Completion means the home consumes the agreed canonical contract, definitions have owners,
comparisons and permissions are covered by meaningful tests, and duplicate local definitions are
removed. This document remains open until that work is delivered.
