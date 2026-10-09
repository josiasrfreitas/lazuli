"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { parseAsStringLiteral, useQueryStates } from "nuqs";
import { useCallback, type ReactNode } from "react";

import { Button } from "@lazuli/ui";

import { ArtworkExplorer } from "./artwork-explorer";
import {
  COMPOSITIONS,
  conceptDetails,
  TONES,
  VARIANTS,
  type ChangeOptions,
  type Variant,
  type WorkshopOptions,
} from "./concepts";
import { PrototypeSwitcher } from "./prototype-switcher";
import { BrandSpecimens } from "./specimens";
import { ConceptComparison } from "./concept-comparison";

function useWorkshopOptions(): { options: WorkshopOptions; changeOptions: ChangeOptions } {
  const [options, setOptions] = useQueryStates({
    variant: parseAsStringLiteral(VARIANTS).withDefault("E"),
    composition: parseAsStringLiteral(COMPOSITIONS).withDefault("lockup"),
    tone: parseAsStringLiteral(TONES).withDefault("dark"),
  });
  const changeOptions = useCallback(
    (next: Partial<WorkshopOptions>) => {
      void setOptions(next);
    },
    [setOptions],
  );
  return { options, changeOptions };
}

export function BrandWorkshop(): ReactNode {
  const { options, changeOptions } = useWorkshopOptions();
  const concept = conceptDetails(options.variant);
  const selectVariant = useCallback(
    (variant: Variant) => changeOptions({ variant }),
    [changeOptions],
  );
  return (
    <main className="min-h-svh bg-background px-5 pb-32 pt-8 font-grotesk text-foreground sm:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl">
        <WorkshopHeader />
        <ConceptComparison onSelect={selectVariant} variant={options.variant} />
        <ArtworkExplorer onChange={changeOptions} options={options} />
        <BrandSpecimens variant={options.variant} />
        <footer className="border-t border-border py-6 text-sm text-muted-foreground">
          Direção adotada: Ex-líbris nas cores do Lazuli. As outras propostas permanecem como
          registro da exploração.
        </footer>
      </div>
      <PrototypeSwitcher name={concept.name} onChange={selectVariant} variant={options.variant} />
    </main>
  );
}

function WorkshopHeader(): ReactNode {
  return (
    <header className="border-b border-border pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-xs uppercase tracking-widest text-brand">
          Lazuli / Workshop de marca / Rodada 02
        </p>
        <Button nativeButton={false} render={<Link href="/" />} variant="text">
          Voltar ao app <ArrowUpRight aria-hidden="true" />
        </Button>
      </div>
      <div className="mt-6 grid gap-5 lg:grid-cols-3 lg:items-end">
        <div className="lg:col-span-2">
          <h1 className="text-4xl font-medium tracking-tight sm:text-5xl">
            Uma identidade começa aqui.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-muted-foreground">
            O Ex-líbris nas cores do Lazuli é a base escolhida para a identidade. O brand book reúne
            a história, as assinaturas e os primeiros estudos de aplicação.
          </p>
        </div>
        <div className="lg:justify-self-end">
          <Button nativeButton={false} render={<a href="/brand/brand-book.html" />}>
            Abrir brand book <ArrowUpRight aria-hidden="true" />
          </Button>
        </div>
      </div>
    </header>
  );
}
