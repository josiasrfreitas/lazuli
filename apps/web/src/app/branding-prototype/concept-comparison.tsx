import Image from "next/image";
import type { ReactNode } from "react";

import { Button, cn } from "@lazuli/ui";

import { artworkPath, compositionDetails, CONCEPTS, type Variant } from "./concepts";
import styles from "./workshop.module.css";

type ComparisonProps = { variant: Variant; onSelect: (variant: Variant) => void };

export function ConceptComparison(props: ComparisonProps): ReactNode {
  return (
    <section aria-label="Três novas direções e uma referência" className="py-8">
      <div className="grid gap-6 md:grid-cols-3">
        {CONCEPTS.filter((item) => item.key !== "B").map((item) => (
          <ConceptCard {...props} item={item} key={item.key} />
        ))}
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-border pt-5">
        <Image
          alt="Referência anterior: livro aberto"
          className="size-10"
          height={100}
          width={100}
          src={artworkPath({ variant: "B", composition: "symbol", tone: "dark" })}
        />
        <div className="flex-1">
          <p className="text-sm font-medium">B / Livro aberto</p>
          <p className="text-xs text-muted-foreground">Referência da rodada anterior</p>
        </div>
        <Button
          aria-pressed={props.variant === "B"}
          onClick={() => props.onSelect("B")}
          variant="ghost"
        >
          {props.variant === "B" ? "Em foco" : "Rever referência"}
        </Button>
      </div>
    </section>
  );
}

function ConceptCard({
  item,
  variant,
  onSelect,
}: ComparisonProps & { item: (typeof CONCEPTS)[number] }): ReactNode {
  const dimensions = compositionDetails("lockup", item.key);
  return (
    <article className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium">
          <span className="mr-2 text-brand">{item.key}</span>
          {item.name}
        </h2>
        <Button
          aria-pressed={variant === item.key}
          onClick={() => onSelect(item.key)}
          size="compact-responsive"
          variant={variant === item.key ? "secondary" : "ghost"}
        >
          {variant === item.key ? "Em foco" : "Explorar"}
        </Button>
      </div>
      <div
        className={cn(styles.canvas, "flex h-52 items-center justify-center rounded-lg p-5")}
        data-concept={item.key}
        data-tone={item.previewTone}
      >
        <Image
          alt={`Conceito ${item.key}: ${item.name}, com letreiro`}
          className="h-full w-full object-contain"
          height={dimensions.height}
          width={dimensions.width}
          src={artworkPath({ variant: item.key, composition: "lockup", tone: item.previewTone })}
        />
      </div>
      <p className="mt-3 text-sm">{item.character}</p>
      <p className="mt-1 text-xs text-muted-foreground">{item.palette}</p>
    </article>
  );
}
