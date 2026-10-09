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
| `navigation-*`                               | The navy navigation surface and its readable labels, icons, and active items         |
| `table-heading-*`                            | Light blue column headers with navy text in light mode; neutral headers in dark mode |
| `border-subtle`, `border`, `border-strong`   | Row separators, surface frames, and floating panel boundaries                        |
| `primary`, `primary-foreground`              | The main action: navy in light mode and off-white in dark mode                       |
| `accent`, `accent-foreground`                | Selected controls and contextual blue surfaces                                       |
| `interactive`, `icon`                        | Links and supporting interface icons                                                 |
| `brand`, `brand-rule`, `selection-indicator` | Gold identity details, restrained rules, and current-position markers                |

Keep most of the workspace neutral. The navigation stays navy in both themes. Gold appears
in the signature and selected navigation; light tables have a fine gold header rule, while
dark tables use a neutral rule. Dropdowns use ordinary borders without an inset frame.
In dark mode, dialogs use the navigation blue with slightly lighter blue input surfaces;
their primary action stays off-white. Light-mode dialogs keep their white surface.
Use explicit text or shape alongside selection color. Reserve status colors for operational
meaning: a class modality, for example, uses accent or secondary surfaces rather than success.

The header button switches directly between light and dark. The browser's preference supplies
the initial theme; an explicit choice is stored on that browser and applied before the first
paint. Login and access-restriction screens keep their navy entrance surface.

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
