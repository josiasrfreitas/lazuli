# Issue Tracker: Sprint Markdown

This repo uses a local markdown sprint tracker under `docs/sprints/`.

The current MVP sprint is:

`docs/sprints/SP-001-2026-06-18-mvp-week-1/`

## Conventions

- Sprint folders use `SP-###-YYYY-MM-DD-<slug>` naming; see `docs/sprints/README.md`.
- Each sprint has a `README.md` index/dependency map and a `projects/` directory.
- Projects live at `docs/sprints/<sprint>/projects/<NN-slug>/PROJECT.md`.
- Issues start inline inside a project file as `### [PNN-MM]` sections.
- When an issue is handed to an AFK agent or human, promote it to:
  `docs/sprints/<sprint>/projects/<NN-slug>/issues/<PNN-MM>-<slug>.md`.
- Use the sprint's `_templates/ISSUE.md` when promoting a standalone issue.
- Triage state is recorded as a `Status:` line near the top of each project/issue file
  (see `triage-labels.md` for the role strings).
- Comments and conversation history append to the bottom of the file under a `## Comments` heading

## When a skill says "publish to the issue tracker"

For the current MVP, publish into `docs/sprints/SP-001-2026-06-18-mvp-week-1/`.

- New project-level work belongs in the appropriate `PROJECT.md`.
- New handoff-ready work should be a standalone issue under that project's `issues/` directory.
- If the work does not fit an existing project, create a new project folder under
  `docs/sprints/SP-001-2026-06-18-mvp-week-1/projects/` using `_templates/PROJECT.md`.
- If the work belongs to a future planning cycle, create the next `SP-###-YYYY-MM-DD-<slug>`
  folder under `docs/sprints/` and add it to `docs/sprints/README.md`.

Canonical product PRDs remain in their product-doc location, e.g. `docs/MVP/PRD.md`. Sprint issues
link back to PRD/spec/decision anchors through their `Trace` field.

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. If the user passes an issue ID such as `P00-06`, search under
the current sprint's `projects/` directory first.
