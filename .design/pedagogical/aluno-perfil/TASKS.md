# Student profile — #171

The user added an individual student page with pedagogical and financial sections and requested a modern, premium interface. This is an autonomous implementation direction, not a recorded workshop selection.

Direction: restrained typography and strong hierarchy; persistent identity and contact; two accessible page tabs; one current-enrollment composition with attendance, schedule and stage journey; financial ledger through the existing operational-table and payment primitives. Existing semantic tokens support both themes.

Data contract: pedagogical reads are scoped to the exact student, use civil enrollment windows and the established attendance calculation. Finance scopes the existing ledger before totals, grouping and pagination, including contract and beneficiary links. Shared-payer orders for other students must not leak into the profile. Existing admin authorization is retained.

- [x] Route and active profile link from the students preview and class roster.
- [x] Real pedagogical and financial data, explicit empty/loading/error states.
- [x] Payment action composes the existing payment flow.
- [ ] Validate real browser flows, narrow layout and both themes.
- [ ] Inspect complete diff and commit incrementally.

No local lint, tests, typecheck or build per the user's explicit instruction. Integration coverage authored for the changed query contracts; execution left to CI. Commit/push hooks retained.
