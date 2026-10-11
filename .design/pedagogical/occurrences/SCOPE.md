# V10 — Occurrences and interventions

Parent: #156. Replaces the implementation discovery in #138 under the user's autonomous-delivery authorization.

An occurrence reports an atypical situation for one student in a past or current class session. It records category, concise title, factual account, optional initial response, session context, author and recording time. Related occurrences belong to the same student; the relationship is symmetric and does not require an intervention. Original reports remain intact; attributed addenda clarify or correct them.

An intervention groups at least two distinct occurrences for one student and requires an eligible teacher as owner. Administration opens and assigns it; administration or its responsible teacher records follow-up, starts work, concludes with an outcome and reopens with a reason. A next step and optional due date make ongoing work actionable. More motivating occurrences can be added later. A completed intervention retains its narrative and motivating reports. Reassignment preserves a history entry.

Access: administrators see and organize all records. Teachers can report for sessions they actually teach, including substitutions, and read their own reports plus motivating reports of interventions assigned to them. A former assignment does not grant access to a student's whole history. Finance/secretary roles do not receive access to pedagogical narratives. No attachments, outbound communication, scoring or automated escalation in this slice.

UI: Pedagógico → Acompanhamento. An open-work overview and two views (interventions / occurrences), search and state filters; narrative details with chronology and linked motivating reports. Student Pedagógico links to its filtered history. Existing tokens, compact forms and restrained functional typography follow the current Professores/Alunos direction. The alternatives considered were a kanban (too much status manipulation), a dense table (poor narrative context), and a case list with a focused detail view (chosen).

Evidence contract: minimum two distinct reports, same student, scoped teacher access, past/non-cancelled session and enrolled student, attributed append-only history, version conflicts and atomic activity recording. Independent expected examples: two reports for Ana may create an intervention; Ana + Bruno or the same report twice may not. An unrelated teacher must receive no report data. A rejected command must leave no follow-up or success event. Integration coverage will be authored; execution is deferred to CI per the user. Actual flows will be checked in the browser at desktop and narrow widths.

One integrated branch, incremental commits, one web server, no lint/tests/typecheck/build locally. No new PR until the user's integrated product review.
