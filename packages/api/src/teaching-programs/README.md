# Teaching programs

Administrators manage tracks, stages and the book curriculum in the stage catalog. `catalog` returns stage/track metadata and `detail`
returns the persisted units, teaching hours, activities, book lessons and assessments.

A teaching hour is always 60 minutes. Weekly load belongs to `TeachingModality` and defaults to
120 minutes; Regular/PPT is a separate scheduling axis. Units have variable teaching-hour counts
and end with one assessment, which may occupy consecutive teaching hours. Book lessons and their
parts are references, not time slots. Track age group is explicit: CHILD for young children's
tracks and ADULT for adults and teens. This is independent of legal age and financial price terms.

## Import

Run from the repository root with the destination environment loaded:

```sh
pnpm exec dotenv -e .env -- node --import tsx scripts/imports/teaching-program.ts program.json
```

The input contract is `packages/validators/src/teaching-program.ts`; the graph rules live in
`packages/domain/src/teaching-program.ts`. A document identifies the existing stage, its modality,
source provider/reference/revision, lessons, units, teaching hours, assessments and activities.
Every source entity has a stable `key`; activities reference those keys explicitly. Each teaching
hour's activities must total 60 minutes. Counts are read from the imported entities.

An unchanged source revision is idempotent. Changed content needs a new revision. Import retires
the previous current program atomically and preserves its identifiers and records for older plans.
A changed book lesson catalog requires explicit edition reconciliation; imports cannot silently
rewrite existing lesson references. Interactive edits use separate atomic commands. They preserve existing activity IDs, dated plan rows and recorded snapshots. The editor uses the stage import lock when editing lessons or programs. Optional page ranges belong to book activities and supply the pages for newly scheduled rows.

Regular and PPT share the stage's book index. Each lesson owns numbered pages, and a page
contains ordered activities. The hour editor accepts free text or a page range. A range resolves
against the stage's book and links each matching exercise, or the page if it has no exercises.
Imported titles and earlier part references remain readable. Activity edits and moves check
the hour's last change. A move preserves identifiers, durations and the closing assessment.

The development seed adapts the previously supplied 40h/50h PDF transcriptions for the seven
English Main stages. It is not a connection to SGF or another live source. Unknown abbreviations
are retained as provenance with `descriptionPending`, never expanded by guesswork. Other stages
remain visible with a truthful pending-import state. Automatic/bulk external synchronization must
run through the worker boundary when its source is specified.

## Planning and future teacher records

`StagePlanItem.programActivityId` links the dated intention to a source activity. The save boundary
checks the stage and Regular/PPT scope and reads canonical content from the imported activity.
Existing links can retain a retired revision; new links require a current program. Plan revisions
preserve the identifier, and the existing class-record planned snapshot carries it forward.

The future mobile record can use these stable references to report actual work, including partial
or repeated activity, separately for regular shared content and individual PPT content. Recording
actual coverage and its mobile UI are not implemented by this catalog change. Legacy narrative
plans and records remain readable; they are not assigned guessed curriculum links.
