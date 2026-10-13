---
target: Atendimentos e acompanhamento pedagógico no perfil do aluno
total_score: 26
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 1
target_identity: "file:/Users/josiasribeiro/orca/workspaces/lazuli/operacao-pedagogica/apps/web/src/features/students/profile/student-pedagogy.tsx"
target_fingerprint: "sha256:bf75e4ba8c61ecb6d87b3b888eb31ea0363e32a462ab74e440ebdd5bce3e34a7"
target_path: /Users/josiasribeiro/orca/workspaces/lazuli/operacao-pedagogica/apps/web/src/features/students/profile/student-pedagogy.tsx
timestamp: 2026-10-13T12-42-16Z
slug: res-students-profile-student-pedagogy-tsx-d9c6d963
---

Method: dual-agent (A: /root/design_critique · B: /root/detector_evidence)

The serif type, date-led records and school terminology belong to Lazuli. Equal halves inside one
large tinted frame give unrelated amounts of content equal visual space. The opportunity is stronger
editorial hierarchy within the accepted desktop world.

| Nielsen heuristic   | Score / 4 | Evidence                                                        |
| ------------------- | --------- | --------------------------------------------------------------- |
| System status       | 3         | Status and retry present; volume and attention summary missing. |
| Real-world match    | 4         | School vocabulary, ownership, next steps and local dates.       |
| Control and freedom | 2         | Cancellation available; long summaries have no disclosure.      |
| Consistency         | 3         | Shared primitives; inconsistent preview boundaries.             |
| Error prevention    | 3         | Student-bound form and existing validation.                     |
| Recognition         | 3         | Owner and next step visible; list limits unexplained.           |
| Efficiency          | 2         | Contextual links; sequential scanning grows with content.       |
| Minimalist design   | 2         | Equal empty/populated halves and unbounded narratives.          |
| Error recovery      | 2         | Retry available; failure behavior not exercised.                |
| Help                | 2         | Some guidance; time window and history scope too quiet.         |
| Total               | 26 / 40   | Acceptable, with targeted improvements needed.                  |

Strengths: natural Portuguese labels, actionable next steps, attributed ownership and explicit overdue
wording. The current form preserves student context.

Priority issues:

- P1: Unbounded growth and weak priority hierarchy. Bound initial records and the expanded viewport;
  separate appointment rail from the larger follow-up surface; put deadlines next to titles. Use
  bolder/layout without adding colors or visual systems.
- P2: Preview limits and totals are inconsistent. Display exact server totals, explain partial loaded
  histories, and retain direct student-filtered destinations. Use clarify/harden.

Alex cannot estimate hidden work from the old agenda preview. Sam encounters verbose record links
with entire next-step narratives. Jordan may read the empty three-month agenda as no appointments
at all. The emotional valley is a large empty field beside overdue work presented as routine.

Detector: zero CLI findings in all three target files; live browser detector also reported zero.
No false positives. Browser evidence measured equal 1376.5 px columns at 2877 × 1242, with a roughly
512 px shared height even for the empty appointment side. Source confirms no follow-up height cap.
The independent visual assessment preceded synthesis of detector findings.

Alternatives considered: compact summaries with route-only expansion; bounded lists with inline
expansion and scrolling; one combined tabbed section. Choose bounded lists per the user's requested
limit/expansion, keeping appointments simultaneously visible and using tabs only for intervention
versus occurrence records. Preserve the accepted editorial desktop direction.

Questions skipped: the user already specified priorities, scope, editorial direction and expansion;
this combined critique-and-improvement request authorizes implementation.
