# `@shadcn/lint` baseline

Date: 2026-09-14  
Scope: `apps/web/src/**/*.{js,jsx,ts,tsx}`  
Command: `pnpm -F @lazuli/web lint`

The baseline was measured with all six rules enabled. Shared components are recognized through
`^@lazuli/ui(/|$)`; built-in `cn` and `cva` recognition is sufficient. Lazuli's Tailwind theme is
loaded from `apps/web/src/app/globals.css`, which imports `@lazuli/ui/styles.css`.

## Rule matrix

| Rule                     | Severity |                          Findings | Disposition                                                                                                                         |
| ------------------------ | -------- | --------------------------------: | ----------------------------------------------------------------------------------------------------------------------------------- |
| `no-inline-styles`       | error    |                                 0 | Gate now. Inline presentation must use a class and a Lazuli token or component API.                                                 |
| `no-restyle`             | warn     |                                23 | Observe. Consumers may own layout; remaining component-owned styling needs variants, narrow contracts, or remediation.              |
| `no-arbitrary-values`    | warn     |                                20 | Observe. Characterize approved editorial/layout values before replacing them with tokens.                                           |
| `no-raw-colors`          | warn     |                                33 | Observe. Four branded Google SVG fills are intentional; the other findings are mostly typography utilities misclassified as colors. |
| `no-unknown-classes`     | warn     | 0 normally; 10 on worker fallback | Observe. A successful theme-aware run is clean, but the bundled-grammar fallback misclassifies Lazuli utilities.                    |
| `require-static-classes` | error    |                                 0 | Gate now. The student table's fixed widths and fact tones are statically enumerable.                                                |

`no-restyle` now allows the `layout` category globally. This is the consumer contract: pages may
place and size a shared primitive, while its internal spacing, shape, typography, color, and state
styling remain component-owned. Its diagnostic messages direct contributors to existing sizes,
variants, semantic tokens, and parent layout.

## Representative findings

- Login restyling: `src/app/login/login-card.tsx:133` changes Alert spacing, shape, and color;
  `login-form.tsx:23` and `:30` apply product-specific Input treatments.
- Raw brand colors: `src/app/login/google-mark.tsx:14`, `:18`, `:22`, and `:26` reproduce Google's
  required multicolor mark and should eventually receive a narrow exception.
- Typography discovery: `text-h2`, `text-caption`, and `text-micro` are valid utilities declared by
  the shared theme, but `no-raw-colors` and/or `no-unknown-classes` report them. These rules cannot
  become errors until upstream discovery or a supported configuration resolves that ambiguity.
- Table widths: `src/features/students/students-table.tsx` keeps fixed columns through explicit
  percentage widths. They are now statically readable, which adds five existing values to the
  `no-arbitrary-values` inventory; preserve that layout until this rule's separate remediation.
- Form grid: `src/features/students/new-student/dados-step.tsx:35` uses an intentional arbitrary
  grid template; decide whether it is a reusable form-layout contract or a theme utility.
- Marquee layout: `src/components/marquee/marquee-layout.tsx:26-46` and `:107` contain editorial
  clamp, grid, and viewport values. Preserve the approved composition unless a named token is
  reused elsewhere.

## Controlled probe

A temporary `apps/web/src/__shadcn_probe.tsx` imported `Button` from `@lazuli/ui` and contained:

```tsx
<div className="bg-background text-foreground rounded-huge" style={{ color: "red" }} />
<Button className="p-4">Teste</Button>
```

Running ESLint reported exactly the intended policy failures:

```text
shadcn/no-unknown-classes: "rounded-huge" is not a class this project's Tailwind knows
shadcn/no-inline-styles: Inline style sets color. Style through classes
shadcn/no-restyle: "p-4" is not allowed on <Button>: <Button> owns its spacing
```

The command exited with status 1 because `no-inline-styles` is an error. It did not report
`bg-background` or `text-foreground`, proving that semantic color tokens are accepted. Recognition
of `p-4` on the imported `Button` proves the monorepo component boundary. The temporary probe was
removed after the run.

## Promotion criteria

- Promote `no-restyle` after repeated legitimate overrides have variants or narrow component
  contracts and all unexplained findings are removed.
- Promote `no-arbitrary-values` after the form/table/marquee values are either named tokens or
  documented narrow exceptions.
- Promote `no-raw-colors` and `no-unknown-classes` only when Lazuli typography utilities are
  resolved correctly and the Google mark has a narrow supported exception.
- Promote `require-static-classes` after both table findings are statically enumerable.

During one baseline run, the plugin's Tailwind worker timed out twice and used its bundled grammar
for `no-unknown-classes`. Keep that rule observational until normal runs resolve the project theme
consistently.
