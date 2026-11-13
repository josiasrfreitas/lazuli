# Academic Calendar — Existing Token Contract

Phase 4 complete: reuse explicitly selected by the user. No new palette, fonts,
theme mechanism or token stylesheet is needed.

- Colors: `packages/ui/src/styles/tokens/color.css`, including light/dark semantics.
- Typography: existing Cambria display/body and Calibri numeric stack.
- Spacing/control sizes: `scale.css`; compact aligned groups.
- Motion: `effects.css`; no entrance stagger or calendar width animation.
- Active academic dates use ordinary foreground; vacations use muted surfaces;
  explicit suspensions use warning semantics; boundaries use interactive emphasis;
  events use informational markers. Every color has a text/shape equivalent.
- Shared Button, SegmentedControl, Dialog, Alert, Field and ScheduleCalendar own
  their internal styling. Product CSS only composes calendar-specific layout.
- Desktop and narrow layouts, light/dark and reduced motion are validated in Orca.
