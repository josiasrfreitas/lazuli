# Design review: Financial settings

Reviewed against: DESIGN_BRIEF.md, repository form guidance, and the user's updated direction.
Date: 2026-09-24
Direction: dense ERP form, centered content, concise Portuguese labels, current values first.

## Summary

The page opens with persisted values and an explicit Edit action. Currency and percentages include their units, while editing preserves plain decimal input. Explanations are available under “Como são calculados”.

## Screenshots captured

All paths below are relative to this directory. The application uses its existing dark theme.

| Screenshot                                            | Viewport   | State                       |
| ----------------------------------------------------- | ---------- | --------------------------- |
| screenshots/review-settings-read-desktop-1280.png     | 1280 × 800 | Current values              |
| screenshots/review-settings-read-tablet-768.png       | 768 × 1024 | Current values              |
| screenshots/review-settings-read-mobile-375.png       | 375 × 812  | Current values              |
| screenshots/review-settings-edit-desktop-1280.png     | 1280 × 800 | Edit                        |
| screenshots/review-settings-edit-tablet-768.png       | 768 × 1024 | Edit                        |
| screenshots/review-settings-edit-mobile-375.png       | 375 × 812  | Edit                        |
| screenshots/review-settings-save-error-mobile-375.png | 375 × 812  | Failed save, draft retained |

## Verified

- Content is centered within the available application area, with a maximum width of 576 px.
- Desktop fields are 28 px high. Below 640 px, fields and action buttons are 44 px high; input text is 16 px.
- Grids reorganize into two columns on narrower screens. No horizontal overflow at 375, 640, 768, or 1280 px.
- Read and edit views fit the tested viewport heights without vertical scrolling.
- Existing typography, color, focus, error, and spacing tokens are reused. Compact input size is documented in Storybook.
- Fields have labels, decimal keyboards, examples, and no number spinners. Read mode uses description lists.
- Keyboard order, initial focus, Enter submission, invalid-field focus, and focus restoration after Cancel were exercised in the browser.
- Cancel discards the draft. Failed saves preserve every value. A successful save and reload preserved all six seeded values.
- Derived tuition minimum updates correctly and hides invalid results.

## Must fix

No remaining blocking finding in the exercised flows. Review caught and corrected daily/monthly interest being treated as currency during precision validation; a regression test covers fractional interest and percentage bounds.

## Could improve

- Navigating away during editing discards the draft without a warning. Consider a dirty-form guard if accidental navigation becomes frequent.
- Concurrent administrator edits currently use last-write-wins behavior. A version check would be a separate API change.
- Touch devices at tablet widths retain compact desktop controls. Consider a coarse-pointer size override if tablets are a primary workstation.

## Validation limits

Browser checks used desktop Chromium at the stated viewport sizes; native mobile keyboards and assistive technology were not exercised. Contrast was reviewed against existing shared tokens, without a new automated contrast audit. Web/UI tests, relevant typechecks, lint, style/component gates, and seed idempotency were checked. Full build and infrastructure suites were not repeated for this presentation pass; those broader backend checks belong to the existing settings implementation.
