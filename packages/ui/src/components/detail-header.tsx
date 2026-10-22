import type { ReactElement, ReactNode } from "react";
import { cn } from "../lib/utils";

type DetailHeaderProps = {
  title: ReactNode;
  metadata?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  variant?: "plain" | "card";
  size?: "sm" | "md";
  metadataPlacement?: "inline" | "below";
};

/** Page identity and optional facts. Put navigation or actions in the trailing slot. */
export function DetailHeader({
  title,
  metadata,
  actions,
  children,
  variant = "plain",
  size = "md",
  metadataPlacement = "inline",
}: DetailHeaderProps): ReactElement {
  return (
    <header
      data-slot="detail-header"
      className={cn(
        "grid min-w-0",
        variant === "card" ? "gap-4 border border-border bg-accent px-5 py-4" : "gap-2 pb-2",
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2">
        <div
          className={cn(
            "mr-auto min-w-0",
            metadataPlacement === "below" ? "grid gap-1" : "flex flex-wrap items-center gap-3",
          )}
        >
          <h1
            className={cn(
              "break-words font-display text-2xl font-medium tracking-tight text-heading",
              size === "md" && "sm:text-3xl",
            )}
          >
            {title}
          </h1>
          {metadata}
        </div>
        {actions}
      </div>
      {children && (
        <div className={variant === "card" ? "border-t border-border/60 pt-4" : undefined}>
          {children}
        </div>
      )}
    </header>
  );
}

/** Compact definition list for entity facts; labels remain next to their values. */
export function DetailFacts({
  children,
  layout = "inline",
}: {
  children: ReactNode;
  layout?: "inline" | "columns";
}): ReactElement {
  return (
    <dl
      data-slot="detail-facts"
      data-layout={layout}
      className={cn(
        "group/detail-facts min-w-0",
        layout === "columns"
          ? "grid gap-x-8 gap-y-4 sm:grid-cols-2 xl:grid-cols-4"
          : "flex flex-wrap items-center gap-x-6 gap-y-1",
      )}
    >
      {children}
    </dl>
  );
}

export function DetailFact({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}): ReactElement {
  return (
    <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 group-data-[layout=columns]/detail-facts:flex-col group-data-[layout=columns]/detail-facts:gap-y-1">
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-base group-data-[layout=columns]/detail-facts:flex group-data-[layout=columns]/detail-facts:min-h-control-sm group-data-[layout=columns]/detail-facts:items-center sm:text-sm">
        {children}
      </dd>
    </div>
  );
}
