# Lazuli brand book — edition 01

Open [the visual book](index.html) or [the PDF](lazuli-brand-book.pdf). The local app
also serves the book at `/brand/brand-book.html`. Logo files are in `assets/`.

The [contact sheet](preview.png) shows all 15 pages at a glance.

## Recorded direction

On 2026-10-09, the creator selected **Ex-líbris in Lazuli's existing colors** as the
starting point of the identity. The approved full-size seal and outlined lettering
are preserved in `source/masters/`.

The creator explained the name: “eu escolhi lazuli pq comecei usando azul e tal e
por causa da pedra preciosa”. The book records the blue used at the beginning and
the inspiration from lápis-lazúli. The owl's associations with wisdom, education
and attention were also supplied by the creator.

The narrative, verbal signature, graphic language, applications, minimum sizes
and optical small-size adaptation are the development of that selected base in
this first edition. Application examples are illustrative and contain no real
school records. This is the software's identity, not a replacement for the
school's own name or identity on its documents.

## Files

| Location                      | Purpose                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------- |
| `index.html`                  | Self-contained visual book, chapter navigation and readable transcripts; opens offline            |
| `lazuli-brand-book.pdf`       | Vector PDF with 15 pages                                                                          |
| `identity.json`               | Colors, asset inventory and proposed minimum sizes                                                |
| `assets/svg/`                 | Transparent vector signatures: symbol, small symbol, stacked, horizontal and wordmark             |
| `assets/png/`                 | Transparent raster exports; symbols at 1024 px, compositions at 1920 px; separate 32 px specimens |
| `applications/`               | Six separate editable SVG compositions with PNG exports                                           |
| `pages/`                      | Each page of the book in SVG and PNG                                                              |
| `source/masters/`             | Copy of the selected full-size artwork used to rebuild the official kit                           |
| `source/build.py`             | Offline generator for assets, book, PDF and public runtime copies                                 |
| `preview.svg` / `preview.png` | Contact sheet for reviewing every page together                                                   |

## Choosing an asset

- `dark` means artwork intended for a dark background: gold seal and light lettering.
- `light` means artwork intended for a light background: gold seal and navy lettering.
- `mono-navy`, `mono-white` and `mono-black` use one ink for the entire signature.
- `symbol-small` is the 32 px adaptation: a stronger stroke and one fewer internal
  line. The full-size master remains unchanged.
- The SVG and logo PNG backgrounds are transparent. Application and page exports
  include their designed backgrounds.

Use the provided outlined wordmark instead of recreating it with typed text. No
font files are included. Body typography in the app keeps the existing system
stacks in `packages/ui/src/styles/tokens/typography.css`.

The colors match `packages/ui/src/styles/tokens/color.css`. Printing examples are
concept artwork, without bleed or a print-specific color profile. Confirm small
strokes and colors with a physical proof before producing material.

## Rebuild and runtime copies

From the repository root, with `uv` and `rsvg-convert` installed:

```sh
uv run --with pypdf python 'branding/brand book/source/build.py'
```

The generator uses the stored masters, not installed font files, for all brand
lettering. Editorial text uses local Georgia and Helvetica Neue fallbacks. It
renders with librsvg and assembles the PDF with pypdf; no browser is involved.

It copies the final SVG logos, HTML book and PDF into `apps/web/public/brand/`.
These are runtime exports of this folder. Edit this source and rebuild rather
than changing public copies independently. The selected identity is used by
`apps/web/src/components/app-shell/brand-signature.tsx` at 32 px in the sidebar.

## Historical reference

The book's narrow historical statement about Athena and the owl appearing on
ancient Athenian coins is supported by the
[British Museum collection, coin 1896,0703.233](https://www.britishmuseum.org/collection/object/C_1896-0703-233).
The meanings assigned to the contemporary Lazuli identity are design interpretations.
