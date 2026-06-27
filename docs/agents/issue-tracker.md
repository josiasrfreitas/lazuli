# Issue Tracker: Linear

Work is tracked in **Linear**. Do not duplicate issues or sprint plans in this repo — product scope stays in `docs/MVP/`; execution lives in Linear.

## Conventions

- Create and update issues, projects, cycles, and dependencies in Linear only.
- Link issues back to PRD/spec/decision anchors in the description (e.g. `TECHNICAL_SPEC §4.2`, `S-STU-1`, `D-0033`).
- Use Linear labels for triage state (see `triage-labels.md`).
- Canonical product PRDs remain in `docs/MVP/PRD.md`. Linear issues reference those anchors; they do not replace them.

## When a skill says "publish to the issue tracker"

Create or update the issue in Linear. Do not add markdown issue files under `docs/`.

- New work → new Linear issue in the appropriate project/team.
- Blockers and dependencies → Linear relations or explicit notes on the issue.
- Scope or acceptance changes that affect the product → update `docs/MVP/PRD.md` and/or `docs/MVP/decisions.md` first, then reflect the link in Linear.

## When a skill says "fetch the relevant ticket"

Use the Linear issue ID or URL the user provides, or search Linear by title/identifier. Legacy IDs such as `P00-06` or `GRE-8` may still appear in code comments — look them up in Linear if needed.
