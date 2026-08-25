import type { ReactNode } from "react";

import { cn } from "@lazuli/ui";

/**
 * The frame shared by every screen outside the authenticated product — login,
 * 403, and the error pages that follow.
 *
 * These screens speak in a different voice from the tool itself: navy field, a
 * faint survey grid, a heavy grotesk headline, monospaced labels. The switch of
 * voice is what marks the passage from outside to inside, so the tokens it uses
 * (`--marquee-*`, `font-grotesk`, `font-mono`) belong to this frame alone.
 */
export function MarqueePage({ children }: { children: ReactNode }): ReactNode {
  return (
    <main className="relative isolate min-h-svh overflow-hidden bg-marquee font-grotesk text-marquee-foreground">
      <SurveyGrid />
      <div
        className={cn([
          "relative mx-auto grid min-h-svh w-full max-w-[1440px] content-center gap-14",
          "px-6 py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] lg:items-center lg:gap-20 lg:px-16",
        ])}
      >
        {children}
      </div>
    </main>
  );
}

/** Faint surveyor's grid, faded out toward the edges so it never competes. */
function SurveyGrid(): ReactNode {
  return (
    <div
      aria-hidden="true"
      className={cn([
        "pointer-events-none absolute inset-0 -z-10 opacity-70",
        "[background-image:linear-gradient(to_right,var(--marquee-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--marquee-border)_1px,transparent_1px)]",
        "[background-size:104px_104px]",
        "[mask-image:radial-gradient(120%_90%_at_20%_0%,black,transparent_75%)]",
      ])}
    />
  );
}

/**
 * The left column: everything the reader is meant to read, in reading order.
 * Each block below carries its own top margin instead of a uniform gap — the
 * eyebrow labels the headline so it sits close, while the closing note is a
 * footer and stands apart. Even spacing would flatten that grouping.
 */
export function MarqueeEditorial({ children }: { children: ReactNode }): ReactNode {
  return <div className="flex max-w-2xl flex-col">{children}</div>;
}

export type MarqueeEyebrowProps = {
  /** The classification, set in the accent colour — "ERRO 403", "ACESSO". */
  label: string;
  /** What it refers to, in plain words — "VEIO INACESSÍVEL". */
  detail: string;
};

export function MarqueeEyebrow({ detail, label }: MarqueeEyebrowProps): ReactNode {
  return (
    <p className="flex items-center gap-4 font-mono text-micro font-semibold uppercase tracking-eyebrow">
      <span className="text-marquee-accent">{label}</span>
      <span aria-hidden="true" className="h-px w-10 bg-marquee-border" />
      {/* Muted so the classification leads; at full foreground the detail
          outshines the accent label it merely qualifies. */}
      <span className="text-marquee-muted">{detail}</span>
    </p>
  );
}

export type MarqueeTitleProps = {
  /** First line, in the plain foreground colour. */
  lead: string;
  /** Second line, in gold — the half that carries the verdict. */
  accent: string;
};

export function MarqueeTitle({ accent, lead }: MarqueeTitleProps): ReactNode {
  return (
    <h1 className="mt-5 text-hero font-bold">
      <span className="block">{lead}</span>
      <span className="block text-brand">{accent}</span>
    </h1>
  );
}

export function MarqueeBody({ children }: { children: ReactNode }): ReactNode {
  return (
    <p className="mt-7 max-w-[38ch] text-body leading-relaxed text-marquee-muted">{children}</p>
  );
}

export function MarqueeActions({ children }: { children: ReactNode }): ReactNode {
  return <div className="mt-10 flex flex-wrap items-center gap-4">{children}</div>;
}

/*
 * Buttons on this surface are square-cornered, because every frame here is:
 * the card, the grid, the registration marks. Rounding them would make them
 * look like they wandered in from the tool.
 */

/** The one action the screen wants taken. */
export const marqueeActionClass = cn([
  "h-control-lg rounded-none px-6 font-grotesk text-control font-bold",
  "bg-marquee-accent text-marquee-accent-foreground",
  "hover:bg-marquee-accent/85 active:bg-marquee-accent/75",
]);

/** Everything else: available, but not asking to be clicked. */
export const marqueeQuietActionClass = cn([
  "h-control-lg rounded-none border-marquee-border px-6 font-grotesk text-control font-bold",
  "bg-transparent text-marquee-foreground",
  "hover:bg-marquee-foreground/8 hover:text-marquee-foreground active:bg-marquee-foreground/12",
]);

/** Closing line under a rule — a filing code, not a message. */
export function MarqueeNote({ children }: { children: ReactNode }): ReactNode {
  return (
    <p className="mt-12 flex items-center gap-4 font-mono text-micro uppercase tracking-eyebrow text-marquee-muted">
      <span aria-hidden="true" className="h-px w-10 bg-marquee-border" />
      {children}
    </p>
  );
}
