---
version: 1
slug: "apps-web-src-features-admin-home-home-tsx"
primary_target: "apps/web/src/features/admin-home/home.tsx"
related_targets:
  ["apps/web/src/app/login/login-card.tsx", "apps/web/src/features/admin-home/home-arrival.tsx"]
---

# Admin home: reference-led composition

Mode: Operate. Preserve Lazuli typography, semantic colors, navigation and the existing login arrival.

The user rejected both the nearly empty initial state and the generic equal-card dashboard.
The supplied Intelly dashboard reference now owns the composition: a narrow bar-chart card next
to a wider line-chart card, two low summaries below, and a lower pending
work section with compact rows and an adjacent detail panel. Use the available width with modest
side margins. The latest user instruction removes the calendar/agenda rail entirely; metrics and
pending work use the full content width. No black enclosing panel around pending work and no isolated gold divider.

Metrics must communicate actual relationships, not repeat decorative sparklines. Enrollment bars
show monthly entries; receipt lines distinguish cash received from amounts expected by due month;
student ages use a donut of active students, and trials compare the same elapsed days of adjacent
months. A compact conversion card shows the share of leads created in the month that now link
to a non-deleted student, with both counts visible. It does not imply new-to-school acquisition.
Do not infer conversion, growth of the active base, or payment coverage from unrelated cohorts.
The latest density pass uses three compact cards in the second row, smaller typography and gaps,
and tighter pending rows. Keep the eight-month enrollment bars thin and vertically readable.

Pending work remains grouped by type and ordered by the accepted interview scores. A selection
previews actual cases or aging buckets; direct area links and individual case links lead to the
existing resolution pages. No mutations in the home. Prioritize by urgency rather than volume.
The full cross-product state map is not implemented by this visual slice.

Explicit user constraints override the usual finish workflow: no tests, checks or lint; visual
inspection on desktop only. No new interview, alternative tournament or independent review round.
The reference determines the current direction; user acceptance of the implementation remains open.
