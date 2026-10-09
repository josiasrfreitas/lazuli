import { Download, Moon, Sun } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";

import { Button, cn } from "@lazuli/ui";

import {
  artworkPath,
  COMPOSITION_OPTIONS,
  compositionDetails,
  conceptDetails,
  type ChangeOptions,
  type WorkshopOptions,
} from "./concepts";
import styles from "./workshop.module.css";
import { ExLibrisComparison } from "./ex-libris-comparison";

export function ArtworkExplorer({
  options,
  onChange,
}: {
  options: WorkshopOptions;
  onChange: ChangeOptions;
}): ReactNode {
  return (
    <section aria-label="Explorar a direção selecionada" className="border-t border-border py-8">
      <ArtworkControls onChange={onChange} options={options} />
      {options.variant === "E" ? (
        <ExLibrisComparison options={options} />
      ) : (
        <div className="grid gap-8 lg:grid-cols-3">
          <ArtworkCanvas options={options} />
          <ConceptNotes options={options} />
        </div>
      )}
    </section>
  );
}

function ArtworkControls({
  options,
  onChange,
}: {
  options: WorkshopOptions;
  onChange: ChangeOptions;
}): ReactNode {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
      <div aria-label="Composição da logo" className="flex flex-wrap gap-1" role="group">
        {COMPOSITION_OPTIONS.map((item) => (
          <Button
            aria-pressed={options.composition === item.key}
            key={item.key}
            onClick={() => onChange({ composition: item.key })}
            size="compact-responsive"
            variant={options.composition === item.key ? "secondary" : "ghost"}
          >
            {item.label}
          </Button>
        ))}
      </div>
      <div aria-label="Fundo da aplicação" className="flex gap-1" role="group">
        <Button
          aria-pressed={options.tone === "dark"}
          onClick={() => onChange({ tone: "dark" })}
          size="compact-responsive"
          variant={options.tone === "dark" ? "secondary" : "ghost"}
        >
          <Moon aria-hidden="true" /> Escuro
        </Button>
        <Button
          aria-pressed={options.tone === "light"}
          onClick={() => onChange({ tone: "light" })}
          size="compact-responsive"
          variant={options.tone === "light" ? "secondary" : "ghost"}
        >
          <Sun aria-hidden="true" /> Claro
        </Button>
      </div>
    </div>
  );
}

function ArtworkCanvas({ options }: { options: WorkshopOptions }): ReactNode {
  const composition = compositionDetails(options.composition, options.variant);
  return (
    <div
      className={cn(
        styles.canvas,
        "flex min-h-72 flex-col rounded-lg p-6 sm:min-h-80 sm:p-10 lg:col-span-2",
      )}
      data-concept={options.variant}
      data-tone={options.tone}
    >
      <p className="font-mono text-xs uppercase tracking-widest">
        {options.variant} / {composition.label} / {options.tone === "dark" ? "Escuro" : "Claro"}
      </p>
      <div className="flex flex-1 items-center justify-center py-8">
        <Image
          alt={`Direção ${options.variant}, ${composition.label.toLowerCase()}`}
          className={
            options.composition === "symbol"
              ? "size-40 sm:size-48"
              : "h-52 w-full max-w-2xl object-contain sm:h-64"
          }
          height={composition.height}
          width={composition.width}
          src={artworkPath(options)}
        />
      </div>
      <p className="text-xs">{conceptDetails(options.variant).palette}</p>
    </div>
  );
}

function ConceptNotes({ options }: { options: WorkshopOptions }): ReactNode {
  const concept = conceptDetails(options.variant);
  return (
    <div className="flex flex-col justify-between gap-6">
      <div>
        <p className="font-mono text-xs text-brand">DIREÇÃO {options.variant}</p>
        <h2 className="mt-2 text-3xl font-medium tracking-tight">{concept.name}</h2>
        <p className="mt-4 text-base text-muted-foreground">{concept.description}</p>
        <dl className="mt-5 space-y-4 text-sm">
          <div>
            <dt className="font-medium">O que ganha</dt>
            <dd className="mt-1 text-muted-foreground">{concept.strength}</dd>
          </div>
          <div>
            <dt className="font-medium">O que considerar</dt>
            <dd className="mt-1 text-muted-foreground">{concept.tradeoff}</dd>
          </div>
        </dl>
      </div>
      <ArtworkDownloads options={options} />
    </div>
  );
}

function ArtworkDownloads({ options }: { options: WorkshopOptions }): ReactNode {
  return (
    <div className="flex flex-wrap gap-2">
      {(["png", "svg"] as const).map((format) => (
        <Button
          key={format}
          nativeButton={false}
          variant={format === "png" ? "primary" : "secondary"}
          render={
            <a
              download={`lazuli-${options.variant.toLowerCase()}-${options.composition}-${options.tone}.${format}`}
              href={artworkPath(options).replace(/\.svg$/, `.${format}`)}
            />
          }
        >
          <Download aria-hidden="true" /> Baixar {format.toUpperCase()}
        </Button>
      ))}
    </div>
  );
}
