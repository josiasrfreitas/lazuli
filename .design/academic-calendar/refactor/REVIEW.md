# Academic calendar visual finish review

Date: 2026-11-13. Final disposition: **ship**, from a verdict pass over two material corrections.

## Review sequence and scope

The initial annual-view review returned ship. That historical verdict is superseded by the fresh
full review of the accepted period/vacation refinements and its subsequent correction pass.

The full period review found typography, material, background, composition and navigation matched
the accepted direction, and all required captures were valid. It returned **fix** for two material
findings. Both were corrected together, and the current captures were refreshed after that batch.
The final verdict pass scored those two findings, rather than repeating a whole-surface review:

| Material finding                                                  | Final score  | Evidence and limit                                                                                                                                                                                 |
| ----------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Holiday tooltips used vacation impact copy when both applied.     | **Resolved** | Source prioritizes holiday copy and explicitly suspends aulas, atendimentos e experimentais. The attempted hover capture did not expose the tooltip, so its rendered text is not runtime evidence. |
| Selected-day and daily context lost the adjacent vacation ranges. | **Resolved** | Refreshed desktop and selected mobile captures retain both adjacent ranges and the undefined-neighbor labels.                                                                                      |

The scored correction list has no remaining findings. The reviewer returned **ship** at that
scope; this does not constitute another whole-surface approval or automated correctness review.

## Evidence provenance

The final captures are in `.impeccable/review/academic-calendar/`. They were recaptured after the
fix batch and opened: `desktop.png` (1440×1000), `year-full.png` (1440×1900), `user-1026.png`
(1026×812), `mobile.png` (390×844), `vacations-context-mobile.png`, `month-desktop.png`
(January 2027), `vacations-after-day.png` (January 5), `daily-desktop.png` (January 5),
`vacations-selected-mobile.png` (390 px selected context), and `month-mobile-light.png`
(temporary light CSS preview, subsequently restored).

`editor-mobile.png`, `settings-desktop.png` and `impact-mobile.png` remain earlier evidence of
unchanged flows. Current local data has only 2026.2, July 1–December 31, with both period arrows
disabled. The earlier illustrative browser preview of partial February starts, a period sequence
and a cross-year period made no database writes, but predates the final vacation refinements.
It is not current runtime coverage for those final states.

## Validation limits

The builder's Orca observations are in [SCOPE.md](SCOPE.md); accepted decisions and system
continuity are in [OUTCOME.md](OUTCOME.md). This is a visual review. No automated tests, lint,
static checks, detectors or build were run in the final pass, as requested by the user. Four
date-model unit cases passed before that instruction; an earlier typecheck was unsuccessful
and not resumed. Backend reconciliation was preserved without revalidation. Global design
documentation, product context and tokens remain unchanged; no raster assets ship.
