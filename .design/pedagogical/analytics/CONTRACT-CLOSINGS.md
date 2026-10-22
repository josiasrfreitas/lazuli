# Monthly contract closings — issue #178

## Accepted question and composition

“Quanto trouxemos de receita este mês para a escola?” is answered in its commercial sense:
projected nominal tuition from agreements closed this month, with equivalent monthly amount and
contract count beneath it. This follows the user's explicit selection of projected total as the
primary measure. Cash receipts remain a separate section.

Compared a table-first view, separate projected/monthly bars and a single projected bar with an
included monthly segment. The user chose the whole projected value with a portion representing
the equivalent monthly amount. The highlighted portion is included in the total; stacking the
full projection on top of a monthly amount would double-count it. Users can choose which of the
three numbers label each month. The table lists recent months first with exact values.

## Calculation and limits

- Agreement month comes from `Contract.agreedOn`, even for contracts whose services or first
  installment start later. Civil-day cutoff follows America/Sao_Paulo.
- Projected value is original nominal monthly tuition multiplied by contracted duration.
  Monthly equivalent is the sum of those monthly prices; it is not the school's active MRR.
- Payments, conditional discounts, fees and interest do not increase this commercial projection.
  The current contract model has no cancellation lifecycle. Neither guaranteed revenue nor a
  cancellation settlement is inferred from the cancellation-fee percentage.
- Soft-deleted contracts and undated legacy agreements are excluded. Dated agreements with
  incomplete amount/duration still count as contracts; their monetary values are excluded with
  a visible explanation. Future agreements and future months do not appear as current closings.
- Current year highlights the current month to date. A past year summarizes that year's closings.
  The UI explicitly identifies the current month as unfinished.

The seed has 220 contracts distributed over nine months. See [seed distribution](SEED-CLOSINGS.md).
The full isolated seed was applied on 2026-10-11, including 250 students, 22 classes and 7 teachers.

## Browser evidence

Validated the real integrated app on port 3004, keeping one web server:

- October 2026: 10 agreements, R$ 2,350 monthly equivalent and R$ 28,200 nominal projection.
  The headline, exact monthly table and chart tooltip agree with the independently calculated
  seed reference. Actual year-to-date receipts were R$ 209,544.18 in this snapshot.
- Recharts shows the monthly portion inside the projected total. A zero-contract January exposed
  a positional-label defect; labels now resolve by month key. February shows 44 contracts and
  October shows 10, matching the table.
- Enabled monthly labels using Space and closed the selector with Escape. All three measures
  then appeared on each populated month. Arrow-key navigation reached October's tooltip with
  the same exact monetary amounts and count.
- Switched chart/table; inspected 1440×1000 light/dark and 390×844 light/dark layouts. Document
  and main width measured 390 px on mobile. Charts and tables own horizontal scrolling.
  The mobile monthly suffix uses its own line so it does not collide with contract count.
- Navigated to 2025 with zero contracts and an explicit empty state, then 2027 with the future-
  period message, and back to the current month.

Integration coverage was authored for agreement-month grouping, future start dates, nominal
projection without installments or payments, incomplete terms, deletion and civil-date cutoff.
Its independent March expectation is R$ 4,800 projected, R$ 500 monthly and 3 contracts (one has
no duration); an April 1 agreement is excluded on March 31. No local lint, tests, typecheck or
build were run at the user's request. Commit hooks format files and check whitespace.
