import { BookOpen, GraduationCap, Home, Users } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";

import { cn } from "@lazuli/ui";

import { artworkPath, conceptDetails, type Variant } from "./concepts";
import styles from "./workshop.module.css";

const SAMPLE_SIZES = [
  { pixels: 16 },
  { pixels: 24 },
  { pixels: 32 },
  { pixels: 48 },
  { pixels: 64 },
];

export function BrandSpecimens({ variant }: { variant: Variant }): ReactNode {
  return (
    <section className="grid gap-8 border-t border-border py-8 lg:grid-cols-3">
      <SymbolSizes variant={variant} />
      <WordmarkSpecimen variant={variant} />
      <SidebarSpecimen variant={variant} />
    </section>
  );
}

function SymbolSizes({ variant }: { variant: Variant }): ReactNode {
  return (
    <div>
      <h2 className="text-lg font-medium">O símbolo de perto</h2>
      <p className="mt-2 text-sm text-muted-foreground">{conceptDetails(variant).construction}</p>
      <div
        className={cn(styles.canvas, "mt-6 flex flex-wrap items-end gap-5 rounded-lg p-4")}
        data-concept={variant}
        data-tone="dark"
      >
        {SAMPLE_SIZES.map(({ pixels }) => (
          <figure className="flex flex-col items-center gap-3" key={pixels}>
            <Image
              alt={`Símbolo ${variant} a ${pixels} pixels`}
              className="max-w-none"
              height={pixels}
              width={pixels}
              src={artworkPath({ variant, composition: "symbol", tone: "dark" })}
            />
            <figcaption className="font-mono text-xs">{pixels} px</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

function WordmarkSpecimen({ variant }: { variant: Variant }): ReactNode {
  return (
    <div>
      <h2 className="text-lg font-medium">O nome também assina</h2>
      <p className="mt-2 text-sm text-muted-foreground">{conceptDetails(variant).typography}</p>
      <div
        className={cn(styles.canvas, "mt-5 flex min-h-24 items-center rounded-lg p-3")}
        data-concept={variant}
        data-tone="dark"
      >
        <Image
          alt={`Letreiro da direção ${variant}`}
          className="h-auto w-full max-w-64"
          height={100}
          width={320}
          src={artworkPath({ variant, composition: "wordmark", tone: "dark" })}
        />
      </div>
    </div>
  );
}

function SidebarSpecimen({ variant }: { variant: Variant }): ReactNode {
  return (
    <div>
      <h2 className="text-lg font-medium">Na barra lateral</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Símbolo a 32 px e nome na versão expandida.
      </p>
      <div aria-label="Estudo de aplicação na barra lateral" className="mt-5 flex gap-3">
        <div
          className={cn(styles.canvas, "w-16 shrink-0 rounded-lg py-4")}
          data-concept={variant}
          data-tone="dark"
        >
          <Image
            alt="Símbolo na barra recolhida"
            className="mx-auto"
            height={32}
            width={32}
            src={artworkPath({ variant, composition: "symbol", tone: "dark" })}
          />
          <div aria-hidden="true" className="mt-6 flex flex-col items-center gap-5">
            <Home className="size-4" />
            <Users className="size-4" />
            <GraduationCap className="size-4" />
          </div>
        </div>
        <div
          className={cn(styles.canvas, "min-w-0 flex-1 rounded-lg p-4")}
          data-concept={variant}
          data-tone="dark"
        >
          <CompactSignature variant={variant} />
          <SidebarLabels />
        </div>
      </div>
    </div>
  );
}

function CompactSignature({ variant }: { variant: Variant }): ReactNode {
  return (
    <div aria-label="Lazuli" className="flex h-8 items-center gap-2">
      <Image
        alt=""
        className="size-8 shrink-0"
        height={100}
        width={100}
        src={artworkPath({ variant, composition: "symbol", tone: "dark" })}
      />
      <Image
        alt=""
        className="h-8 w-24 min-w-0 object-contain"
        height={100}
        width={320}
        src={artworkPath({ variant, composition: "wordmark", tone: "dark" })}
      />
    </div>
  );
}

function SidebarLabels(): ReactNode {
  return (
    <div aria-hidden="true" className="mt-6 space-y-4 text-sm">
      <p className="flex items-center gap-3">
        <Home className="size-4" /> Início
      </p>
      <p className="flex items-center gap-3">
        <Users className="size-4" /> Alunos
      </p>
      <p className="flex items-center gap-3">
        <BookOpen className="size-4" /> Turmas
      </p>
    </div>
  );
}
