# Timeline

`Timeline` from `@lazuli/ui` displays ordered events in dated groups. It owns the rail,
markers, event cards, responsive layout and typography. The caller owns fetching, pagination,
chronological ordering, grouping and localized date formatting.

```tsx
import { Timeline, type TimelineGroup } from "@lazuli/ui";

const groups: TimelineGroup[] = [
  {
    id: "2026-10-18",
    label: "Hoje",
    description: "18 de outubro de 2026",
    items: [
      {
        id: "event-1",
        title: "Aula registrada",
        timestamp: <time dateTime="2026-10-18T10:30:00-03:00">10:30</time>,
        metadata: "Pedagógico",
        children: <p>Turma da manhã</p>,
        footer: "Registrado pela coordenação",
      },
    ],
  },
];

<Timeline groups={groups} layout="alternating" />;
```

## API

| Prop           | Purpose                                                                                                               |
| -------------- | --------------------------------------------------------------------------------------------------------------------- |
| `groups`       | Ordered groups with stable `id`, text `label`, optional `description`, and ordered `items`. Empty groups are omitted. |
| `layout`       | `single` (default) or `alternating`. Alternation starts at 48rem of component width, independently of viewport width. |
| `emptyState`   | Content displayed when there are no items.                                                                            |
| HTML div props | Accessible labels, IDs and outer layout classes.                                                                      |

Each item accepts a stable `id`, `title`, and optional `icon`, `timestamp`, `metadata`,
`children` and `footer` slots. These slots accept React content, including links and disclosure
controls. Do not put an entire card inside a slot; the component supplies the card surface.

`TimelineSkeleton` accepts `layout` and an accessible `label`. It reserves the same card and
rail layout without introducing focusable controls. Loading additional pages belongs after the
timeline; the activity page uses `PencilLoader` there.

## Accessibility and behavior

- Items retain the supplied DOM and keyboard order in both layouts. Alternation restarts per group.
- Groups use level-two headings and cards use level-three headings; place the timeline below a
  page's level-one heading.
- Markers are decorative and hidden from assistive technology. Repeat meaningful categories in
  visible text.
- Supply `time` elements with `dateTime` for timestamps. Format business time in
  `America/Sao_Paulo` at the call site.
- The component does not invent actions, navigate, manage focus or fetch data.
- Cards use existing semantic surface, border and text tokens in both themes.

See `Components/Timeline` in Storybook for alternating, single-column, narrow-container,
loading, empty and long-content examples. The production consumer is `/atividades`.
