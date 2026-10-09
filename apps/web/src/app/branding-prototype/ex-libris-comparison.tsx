import { Download } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";

import { Button, cn } from "@lazuli/ui";

import { compositionDetails, type WorkshopOptions } from "./concepts";
import styles from "./workshop.module.css";

const PALETTES = [
  {
    key: "lazuli",
    prefix: "e-lazuli",
    name: "Cores do Lazuli",
    description: "Amarelo #D8AD4A, carvão e azul-marinho.",
  },
  {
    key: "suggested",
    prefix: "e",
    name: "Paleta sugerida",
    description: "Verde profundo, creme e ouro fosco.",
  },
] as const;

type Palette = (typeof PALETTES)[number];

export function ExLibrisComparison({ options }: { options: WorkshopOptions }): ReactNode {
  return (
    <div id="ex-libris-palettes" className="scroll-mt-6">
      <h2 className="text-2xl font-medium tracking-tight">Ex-líbris, lado a lado</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Mesmo selo, letreiro e tamanho. Os controles acima mudam as duas versões juntas.
      </p>
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {PALETTES.map((palette) => (
          <PalettePreview key={palette.key} options={options} palette={palette} />
        ))}
      </div>
    </div>
  );
}

function PalettePreview({
  options,
  palette,
}: {
  options: WorkshopOptions;
  palette: Palette;
}): ReactNode {
  const composition = compositionDetails(options.composition, "E");
  const path = `/brand/workshop/${palette.prefix}-${options.composition}-${options.tone}`;
  return (
    <article>
      <div
        className={cn(
          styles.canvas,
          "flex min-h-96 flex-col rounded-lg border border-border p-6 sm:p-8",
        )}
        data-concept="E"
        data-tone={options.tone}
        data-palette={palette.key}
      >
        <h3 className="text-sm font-medium">{palette.name}</h3>
        <div className="flex flex-1 items-center justify-center py-6">
          <Image
            alt={`Ex-líbris: ${palette.name}, ${composition.label.toLowerCase()}`}
            className={options.composition === "symbol" ? "size-48" : "h-64 w-full object-contain"}
            height={composition.height}
            width={composition.width}
            src={`${path}.svg`}
          />
        </div>
        <p className="text-xs">{palette.description}</p>
      </div>
      <PaletteDownloads path={path} name={palette.name} />
    </article>
  );
}

function PaletteDownloads({ path, name }: { path: string; name: string }): ReactNode {
  return (
    <div aria-label={`Downloads: ${name}`} className="mt-3 flex flex-wrap gap-2">
      {(["png", "svg"] as const).map((format) => (
        <Button
          key={format}
          nativeButton={false}
          size="compact-responsive"
          variant="secondary"
          render={<a download href={`${path}.${format}`} />}
        >
          <Download aria-hidden="true" /> Baixar {format.toUpperCase()}
        </Button>
      ))}
    </div>
  );
}
