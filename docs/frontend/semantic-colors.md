# Semantic colors

Lazuli's status palette communicates meaning and the need for attention. Use the existing
semantic tokens in `packages/ui/src/styles/tokens/color.css` and the matching `Badge` variants.
The same meanings apply in light and dark themes.

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
