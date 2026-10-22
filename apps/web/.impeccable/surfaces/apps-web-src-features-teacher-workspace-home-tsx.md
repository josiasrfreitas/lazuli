---
version: 1
slug: "apps-web-src-features-teacher-workspace-home-tsx"
primary_target: "apps/web/src/features/teacher-workspace/home.tsx"
related_targets:
  [
    "apps/web/src/features/teacher-workspace/home-sections.tsx",
    "apps/web/src/features/teacher-workspace/home-parts.tsx",
    "apps/web/src/features/teacher-workspace/home.module.css",
  ]
---

# Teacher home

Mode: Operate.
An extension of Lazuli's existing teacher workspace. Scope is the home and its navigation.
The owner requests compact mobile-first presentation, modest typography, real pending work and
delight. They confirmed both missing grades and assessment appointments, then added upcoming
appointments. Proposed window: seven days. User explicitly prioritized
feature work and browser validation. Visual acceptance remains with the owner.

## Direction contract

THESIS: Help the teacher choose the next useful action without reading a long dashboard.
OWN-WORLD: Existing Cambria and numeric system stacks, navy and blue semantic surfaces,
quiet rules, gold only in the brand detail; inherit both light and dark themes and shared controls.
STORY: Greet the teacher, show the five requested signals, offer the oldest pending lesson,
then make assessments, appointments, exams and planning directly accessible.
FIRST VIEWPORT: A 22px greeting, a compact date and agenda link, five 44px summary links
in two columns on mobile with appointments across the last row, the next lesson and the start of
assessment work. No page-load sequence.
FORM: Compact teaching desk with expandable lists, one prominent register action and a
secondary notices column on desktop. Precisely specified operational extension; no concept seed.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Delight thesis: The teacher should feel welcomed and recognize that completing the diary frees
attention for teaching. One brief book-settling motion acknowledges a reduced pending count.
No sound, loops, gamification, artificial completion or new assets. Reduced motion removes movement.
The zero-record state celebrates only lesson records, never claims all teaching work is complete.

Evidence for planning notices: compare the latest recorded page with content scheduled at least
seven days earlier in the same material. Missing evidence never proves the class is behind.
Unconfigured plans are disclosed beside upcoming exam notices.
