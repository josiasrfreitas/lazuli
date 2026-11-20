# Semantic colors

Components consume semantic roles from `packages/ui/src/styles/tokens/color.css`. Reference
colors (`--lz-ref-*`) stay inside that file. The same roles apply in both themes; components
should not branch on the theme to choose colors.

## Surfaces and emphasis

| Role                                         | Use                                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------------------------ |
| `background`, `card`, `popover`              | Page canvas, working surface, and elevated panels                                    |
| `field`                                      | Editable input surfaces, including selects and textareas                             |
| `heading`, `foreground`, `muted-foreground`  | Headings, content, and supporting information                                        |
| `navigation-*`                               | The theme-aware navigation surface and its readable labels, icons, and active items  |
| `table-heading-*`                            | Light blue column headers with navy text in light mode; neutral headers in dark mode |
| `border-subtle`, `border`, `border-strong`   | Row separators, surface frames, and floating panel boundaries                        |
| `primary`, `primary-foreground`              | The main action: navy in light mode and gold with navy ink in dark mode              |
| `accent`, `accent-foreground`                | Selected controls and contextual blue surfaces                                       |
| `interactive`, `icon`                        | Links and supporting interface icons                                                 |
| `brand`, `brand-rule`, `selection-indicator` | Identity accent, quiet dividers and current-position markers                         |

The school’s light palette places near-white work surfaces (`#F6F8FA`) on a blue-gray canvas
(`#E8EEF5`). Navy (`#0F1B33`) carries text and the primary action. Gold (`#B38838`) appears in
the signature, with darker ink for small interactive details. Fields use an opaque input border.
A selected table row uses the accent fill and its selection control or outline.

The dark canvas is deep navy (`#0A1120`). Cards, navigation and raised dialogs use distinct,
low-saturation surfaces. Body text is `#F1F5F9` and supporting text is `#94A3B8`. Primary buttons
use gold (`#D4A349`) with navy ink through hover and press. Table headers and dividers use neutral
roles. Calendar categories, status labels and line markers keep their operational meanings.

Both staff contexts share the header theme button. A fresh browser starts in dark mode. An explicit
choice is stored under `lazuli-theme` and applied in the document head before paint. With storage
blocked, switching still works for the open document. Login, password recovery and the 403 retain
their institutional dark surface. Projected attendance codes keep black modules on white with a
four-module quiet zone. Finance charts retain labeled data, legends and the existing series roles.

See the [color review and technical measurements](auditoria-visual/revisao-cores.html).

### Academic reading panels

The class page retains its blue overview summary and uses shared dark reading panels for recent
occurrences, performance, and lessons. These panel roles retain the same values in light and dark
mode. The compact, responsive composition uses shared UI controls with their dark-theme variants.

| Role                        | Use                                                                        |
| --------------------------- | -------------------------------------------------------------------------- |
| `academic-panel-surface`    | Persistent near-black background of academic reading panels                |
| `academic-panel-foreground` | Neutral white titles, names, main content, and selected-student chart bars |
| `academic-panel-muted`      | Dates, authors, supporting labels, and reading position                    |
| `academic-panel-accent`     | Restrained gold for chart data, lesson selection, and reading interactions |
| `academic-panel-divider`    | Separators, contextual hover surfaces, and scrollbar thumbs                |

Titles and names inside these panels stay neutral white, including student names that link to
profiles. Gold is exceptional: the performance chart uses it for the class average, with white
for the selected student; selected lessons use a subtle gold tint and a thin edge marker.
Occurrences use gold for category text, the detail link, state icons, and focus indicators.
Scope panel colors through the shared panel roles while preserving the shared controls' variants.

Gold does not encode severity or operational status. Keep status explicit in text and retain the
ordinary status roles, including success for recorded lessons, when status color is needed.

## Status meanings

Use the matching `Badge` variants for status labels. These meanings apply in both themes.

| Meaning                       | Intended feeling                                  | Badge variant | Use                                            |
| ----------------------------- | ------------------------------------------------- | ------------- | ---------------------------------------------- |
| Rest or inactivity            | Calm, no action required                          | `neutral`     | Inativa, Não habilitado, Arquivado             |
| Information                   | Awareness, context                                | `info`        | Substituição, Em análise                       |
| Positive confirmation         | Confidence, readiness                             | `success`     | Ativa, Habilitado, Pago                        |
| Attention                     | Caution, a pending decision or approaching change | `warning`     | Saída programada, Vence hoje, Sem professor    |
| Failure or blocking condition | Urgency, intervention required                    | `destructive` | Erro ao salvar, Conflito de horário, Em atraso |

## Attention hierarchy

### Action buttons

`Button` exposes semantic variants for actions with an explicit operational meaning:

- `success`: positive confirmation, such as recording attendance; filled emphasis.
- `info`: informational adjustments, such as rescheduling; outlined emphasis.
- `warning`: correcting an existing record; outlined emphasis.
- `destructive-ghost`: entering a cancellation or deletion flow; red text with a tinted hover.
- `destructive-outline`: the same destructive intent beside other outlined actions; red outline and text.
- `destructive`: the final cancellation or deletion confirmation; filled red emphasis.

Destructive styling communicates the effect on the record. Closing a dialog or abandoning an
unsaved form uses `secondary` or `ghost`, even when its label is “Cancelar”. Keep an explicit
action label, retain the ordinary focus/disabled/loading behavior, and use the filled destructive
variant on the confirmation that actually changes the record. See `Components/Button` →
`SemanticActions` in Storybook.

### Status attention

Neutral states form the quiet baseline. Information and positive confirmation provide context
without demanding intervention. Warnings draw attention to a condition that needs preparation
or resolution. Errors and blocking conditions receive the strongest emphasis.

This hierarchy describes operational attention, not a numeric severity scale. A disabled login
can be intentional and needs no warning treatment. Use warning when access still needs to be
enabled for an upcoming task; use destructive when an actual failure or blocking condition occurs.
An inactive teacher is an ordinary lifecycle state. A scheduled departure deserves warning
treatment because it announces a forthcoming change.

## Composition

- Always include an explicit status label; color alone cannot convey the state.
- Use tinted backgrounds and semantic text colors for status badges. Reserve filled primary
  buttons for the page's main action; a status badge should not compete with that action.
- Use `Badge` variants instead of setting badge colors in feature components. Other status
  surfaces pair `success`, `warning`, `info`, or `destructive` with their `*-muted` backgrounds.
  Neutral surfaces use `muted` and `muted-foreground`.
- Choose colors by meaning across features. Do not assign a new hue to each domain status.
- Keep lifecycle and access separate: Ativa / Saída programada / Inativa describes teaching
  activity; Habilitado / Não habilitado describes effective system access.

The `Components/Badge` semantic hierarchy story shows these meanings together in both themes.

## Lesson calendar categories

The timeline uses `lesson-regular-surface` / `lesson-regular-foreground` for regular lessons
(blue) and `lesson-personalized-surface` / `lesson-personalized-foreground` for PPT lessons
(purple). Individual experimental lessons use `experimental-surface` / `experimental-foreground`
(teal); appointments use `appointment-surface` / `appointment-foreground` (terracotta).
These category tokens apply in both themes and accompany explicit text in the agenda legend and
cards. They identify event type, not attendance or warning status. Lesson status retains its separate text and status surface;
recording a lesson does not change its modality color. Selection uses an outline, and the current
time line uses `selection-indicator` rather than a warning role.

Home pending contract icons use `contract-surface` / `contract-foreground` (orange). A question
mark accompanies icons for missing records, documents, or assignments; its shape identifies
missing information independently of the category color. Pending contracts and class planning
reviews use an exclamation mark to call attention to the action required.
