# Aulas calendar

Current status: **the user selected the daily teacher grid in [the workshop](workshop/README.md).** That record and its selected HTML sketch own the next implementation direction. The weekly design below was rejected; its technical SHIP disposition is not design acceptance. Everything below is historical context, not the current layout contract.

Mode: Operate. Staff need to distinguish 4–6 concurrent lessons, identify pedagogical stages, and open the correct lesson. The user selected the weekly expandable-block option over a day-first comparison or persistent side panel, and requested animated expansion.

## Superseded weekly direction contract

**THESIS:** One block for overlapping intervals; visible stages identify individual lessons. No hidden scrolling inside calendar events. Dense/short intervals declare their overflow explicitly.

**OWN-WORLD:** Preserve Lazuli typography, neutral surfaces, semantic status tokens, date controls and shared Base UI primitives. No global identity change.

**STORY:** Scan week → recognize stages and count → expand a time block → compare teacher, exact times, class and state → open a lesson. PPT says “Estágios individuais”; no invented shared stage.

**FIRST VIEWPORT:** Date controls above seven weekday columns with a time axis. A one-hour block previews three stage rows and declares the remaining count; expansion exposes all six lessons. Expansion is anchored to its block and presents readable lesson details.

**FORM:** User-pinned local extension, code-led; no seed or image comp. Existing Popover owns focus, dismissal and anchored transform origin. Short transform/opacity transition, instant keyboard access and reduced-motion fallback.

**FINISH:** Record the finish review, verdict, validation limits and incumbent-system comparison here. This ordinary extension preserves system documentation; missing DESIGN.md is a pre-existing gap, not authorization to establish a new identity. Record provenance for any shipping raster.

## Validation contract

Overlap grouping must preserve every lesson and its exact interval, include partial/transitive overlap, and separate touching intervals and dates. Test these pure rules. Verify real database stage projection for Regular/PPT. Browser checks focus on desktop, six lessons, overflow, keyboard dismissal/focus and motion preference. The user explicitly prioritized desktop only after initial narrow checks; no further mobile polish is in scope. This is an extension of the incumbent visual system: preserve existing system documentation, report any pre-existing gaps.

User clarification: lessons occur in one-hour blocks. Size the calendar for six lessons per hour; keep existing persisted demonstration intervals truthful (some are 90 minutes).

## Historical finish record — rejected visually

**Disposition: SHIP for the requested desktop scope.** The finish review found no blocking desktop defects. Six concurrent one-hour lessons show three stage previews and “+3 outras aulas”; the anchored expansion exposes all six lesson links in two columns, with teacher, class, exact time and state. The final hour height is 108px. Empty weeks still render the 08:00–20:00 grid before the empty guidance; this is a nonblocking follow-up, not a system rule.

Compared `calendar*` and shared `Popover` with `docs/frontend/README.md`, shared Button/Badge and the color, typography, scale and effects tokens. The implementation retains neutral surfaces, semantic status colors, Cambria display/body and Calibri numeric stacks, compact spacing, small corners, and shared focus/overlay behavior. Existing system sources remain unchanged by this documentation pass. Root DESIGN.md was already missing; no replacement identity or sidecar was created.

Visual evidence: `.impeccable/review/desktop.png`, `expanded.png` and `six-expanded.png`; the last captures the synthetic six-lesson scenario in desktop Chrome at 1249×780, dark theme. Captures precede the final 104→108px hour-height adjustment; subsequent browser measurement reports 105px client and scroll height, with no block-content overflow. The temporary preview route was removed. Enter opens, Escape closes and returns focus; keyboard opening is instant and pointer opening uses the shared 180ms transition. Reduced-motion fallback was inspected in code only. Desktop is the final acceptance scope; no final mobile acceptance or full accessibility audit is claimed. Screenshots are review evidence, with no shipping raster assets added.

Validation reported by the implementation pass: five calendar unit tests and the new Regular/PPT stage-projection integration test pass. UI typecheck, formatting, component-line/style checks, changed-test quality gate (zero errors/warnings), scoped calendar lint and final diff whitespace check pass. One existing integration test fails its cancellation fixture against `ClassSession_cancel_facts_check`; broader web typecheck fails outside modified files. Shared Popover retains pre-existing generic-unknown lint diagnostics, and existing agenda composition has function-size/complexity diagnostics. These checks are not reported as green; no full production build is claimed.
