# Rebuild development data through one seed

Status: Accepted
Decision date: 2026-09-30
Supersedes: The incremental fixture refresh and separate settings, contracts, and GCS seed workflows previously documented in README.md; no prior decision record
Superseded by: None
Implementation evidence: `scripts/seed.mjs`, `scripts/seed.ts`, `scripts/lib/workspace-maintenance.mjs`

Development and pre-production fixtures are disposable. A single public command, `pnpm seed`,
recreates the current workspace database, applies migrations, and loads the complete versioned
dataset: catalog, staff, academic data, finance settings, standalone orders, contracts, and payments.
It also recreates the workspace fake-GCS bucket and loads its fixture files. Shared Mailpit,
Hatchet, and Compose services remain outside this reset.

Every explicit seed starts from an empty database. Incremental refresh and independent seed
commands are replaced by this workflow, so manual edits and extra records cannot survive a seed.
The data must follow the current model, including one active beneficiary per standalone order
and one student per contract. Different students sharing a payer have separate orders or contracts.

Fixture dates are derived from the current business date in `America/Sao_Paulo`, using relative
month/day offsets and valid civil due dates. Common scenarios (current contracts and future
installments) dominate the dataset; overdue, partial, paid, and cancelled cases provide variation.
Fixed calendar dates are reserved for deterministic test inputs, not the development dataset.

Initial workspace provisioning uses the same dataset loader after creating an empty database.
Repeating workspace setup preserves an already initialized workspace; setup is not a seed command.
The internal loader is an implementation detail, not another public seeding workflow.

Reset validates local resource ownership and operates only on this workspace's database and bucket.
It never selects another workspace through an arbitrary database or bucket argument. A failed seed
is retried by rerunning the complete reset rather than attempting to merge partial fixture state.

This replaces the previous convenience of preserving local edits and filling only missing settings
with a predictable fresh dataset. Existing decisions about catalog structure, account roles, and
record lifecycle remain in effect; this decision changes development provisioning, not product rules.
