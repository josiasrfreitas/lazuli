# Admin home: initial composition

**Historical evidence.** The user rejected this initial composition and the later equal-card
dashboard. The current implementation uses asymmetric metric stories above a two-column pending
work section. The calendar and agenda were subsequently removed at the user’s request. Current scope and decisions are recorded in
[the state map](../operational-states-map-and-interview.md). Checks and screenshots below belong
to the earlier implementation. The current revision is inspected on desktop only, without
tests, lint, or automated checks, at the user's explicit request; visual acceptance remains pending.

Implemented on 2026-10-24 as the user's requested first incremental state. Visual acceptance is
still pending. The state map and accepted priority rules remain in
[operational-states-map-and-interview.md](../operational-states-map-and-interview.md).
The user reinforced desktop as the priority during the finish pass. Narrow captures below are
regression evidence; they do not broaden this slice into a mobile redesign.

The home now presents a greeting, remaining appointments, and a compact monthly summary. It
links to the existing lesson, appointment, class, candidate, and daily agenda pages. Ranked work
queues and the financial summary are intentionally deferred from this first composition; an
empty agenda makes no claim about unresolved work. Existing queue components are retained for
the next incremental decisions. No domain or API behavior changed.

## Authentication arrival

Magic links return to `/?entrada=1`. The authenticated admin page consumes this visual hint,
preserving other query parameters and the hash. The login photograph dissolves while its brand
symbol settles into the sidebar in 760 ms. At narrow widths, where the sidebar is absent, and
with reduced motion, the effect is a 160 ms dissolve. Input, resize, unmounting, or a motion
preference change cancels the sequence. The cover has a CSS deadline if hydration stalls.

The callback parameter grants no access: the existing server authentication and role guards still
run first. A normal navigation or reload does not repeat the effect. The existing login image and
brand SVGs are reused from `apps/web/public/brand`; no new stock or generated assets were added.

## Browser evidence

Chrome on the local worktree, using a real magic link captured by local Mailpit and opened in a
new tab. Populated agenda captures use clearly labeled examples substituted in browser responses,
without writing fictional appointments to the database. The empty capture uses the seeded local
response. These values do not describe production activity.

- [Desktop, dark](screens/desktop-dark.png) and [light](screens/desktop-light.png), 1440 × 1000.
- [Narrow, dark](screens/mobile-dark.png) and [light](screens/mobile-light.png), 390 × 844.
- [320 px width](screens/narrow-320.png), including a wrapping name.
- [Empty agenda](screens/empty-desktop.png) and [unavailable data](screens/error-mobile.png).
- [Keyboard focus](screens/keyboard-focus.png); Enter opens the daily agenda.
- [Arrival at 260 ms](screens/arrival-midpoint.png), sampled by pausing the real animations.
- [Desktop arrival video](screens/desktop-arrival.webm), played at its actual speed.

[Browser results](browser-results.json) record overflow checks, keyboard navigation, motion
interruption, query preservation, reload behavior, reduced motion, and release of the cover with
JavaScript disabled. No horizontal overflow or browser page errors occurred. Mobile screenshots
also exercise the existing administrative mobile notice; it was dismissed before capture.

The existing lesson-detail destination was also opened with a real local session identifier and
rendered its class, teacher, record status, and attendance context. The appointment-detail route
rendered its expected missing-record state; populated appointment details could not be checked
because local fixture setup stopped before creating appointments. The route and its existing
admin guard were verified in source, and the home destination mapping is covered by the tests.

## System documentation

The [finish review](finish-review.md) records `ship`; user visual acceptance remains pending.
This desktop-priority extension was compared with the existing color, typography, scale, and
motion tokens in `packages/ui/src/styles/tokens/`, shared Button and Input primitives, and brand
assets. Those sources remain authoritative. The larger greeting and arrival sequence are local
surface decisions, with no new global DESIGN.md or design sidecar. Existing documentation drift
and login lint warnings remain outside this slice.

## Checks and limits

- Web typecheck and scoped ESLint passed. The untouched login styles have ten existing lint
  warnings; no new warnings were introduced.
- Sixteen focused tests for the admin home and login assets passed, including detail-page
  destinations and the distinction between an empty agenda, failed data, and unresolved work.
- Style and component-length gates passed; the final diff was checked for whitespace errors.
- The full integration, transport, and production-build suites are left to CI: this slice changes
  client presentation and a visual callback hint, with no persistence or transport contract change.

The workspace's full fixture setup failed on the existing `AttendanceWindow_campus_check`
constraint after loading the school and finance fixtures. Browser checks used the available
isolated database, with the web process launched directly. This does not validate missing
attendance fixtures or repair the setup command.
