# Administrative home state presentation

Open [index.html](index.html) directly in a browser, or serve this directory locally. No build,
network dependency, application session, or package installation is required.

The presentation contains **45 captured states and two explanatory slides**. Its essential route
selects 13 slides; the complete index exposes every state. Search also includes states outside the
essential route. Left/right arrows navigate, F or a screenshot click opens enlargement, and the
enlargement supports the original capture size. Hash links identify individual states for feedback.
Printing exports all 47 slides, regardless of the active route or search.

## Evidence and scope

- Captured through the Orca CLI on 2026-10-23, against implementation `e4d7219e`.
- Desktop viewport: 1440 × 1000; application's existing dark theme.
- Screenshots preserve the initial viewport, not the whole scrolling page. They are lossless WebP
  conversions of the original PNG captures; no product visuals were retouched.
- State data is illustrative, injected into the isolated browser tab's query cache and responses.
  No database or product source was changed to create the presentation.
- Time-sensitive scenarios use the response's school date and an illustrative 14:30 snapshot in
  America/Sao_Paulo. Counts and example people are not live school reporting.
- The no-finance state overrides the UI permission prop and omits finance groups. Both existing
  administrative roles currently have financial access; this is not an end-to-end RBAC assertion.
- Static captures show loading composition, not animation timing or quality. Route destinations
  and save operations are not demonstrated by these screenshots.
- This records the current implementation and its stated limits.

The disposable capture scripts and PNG originals were kept in `/tmp/lazuli-home-presentation`;
they are not a durable test suite. The committed presentation is self-contained. `slides.js` owns
the ordered captions, routes, image references, and observed state metadata.

## Related records

- [Pedagogical priority rules and destinations](../admin-home-pedagogical-flow.md)
- [Scenario matrix and earlier behavioral checks](../admin-home-scenarios.md)
- [Explicitly accepted canonical KPI debt](../admin-home-kpi-debt.md)

## Presentation verification

All 47 slides fit the desktop presentation at 1120 and 1440 pixels, with no horizontal or slide
overflow. All 45 screenshot assets decoded successfully. Index/search, route switching, hash links,
enlargement, original-size viewing, and related document links were exercised through Orca. Keyboard
handlers passed synthetic browser events; native keypress could not be asserted while the embedded
page remained unfocused. The PDF export has 47 landscape pages. No static repository gates were run
for this documentation artifact; the owner explicitly deferred lint, typecheck, and formatting.
