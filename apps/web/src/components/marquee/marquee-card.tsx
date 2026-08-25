import type { ReactNode } from "react";

import { cn } from "@lazuli/ui";

export type MarqueeCardMeta = {
  label: string;
  value: string;
};

export type MarqueeCardProps = {
  /** What the frame holds, in the header's left slot — "AMOSTRA MINERAL". */
  title: string;
  /** The catalogue code, in gold on the right — "LAZ-403". Omit when there is
   * no real code to show; inventing one would be decoration pretending to be data. */
  code?: string;
  /** Footer readings, shown left to right with a rule between them. Omit when
   * the card has nothing measured to report — an empty band is not a reading. */
  meta?: readonly MarqueeCardMeta[];
  children: ReactNode;
};

/**
 * A framed specimen: header with a catalogue code, a stage for whatever is on
 * display, and a footer of readings. The 403 page mounts a crystal in it; the
 * login page mounts the sign-in form. Treating both as specimens under the same
 * glass is what makes the two screens read as one pair.
 */
export function MarqueeCard({ children, code, meta, title }: MarqueeCardProps): ReactNode {
  return (
    <section className="relative border border-marquee-border bg-marquee-foreground/[0.015]">
      {/* Header, stage and footer share one left edge (px-6, sm:px-10) — the
          frame bands align with what they frame instead of floating 16px off. */}
      <header
        className={cn([
          "flex items-center justify-between gap-6 border-b border-marquee-border px-6 py-4 sm:px-10",
          "font-mono text-micro font-semibold uppercase tracking-eyebrow",
        ])}
      >
        <span className="text-marquee-muted">{title}</span>
        {code === undefined ? null : <span className="text-brand">{code}</span>}
      </header>

      {/* The stage hugs its contents: the 403 crystal is tall on its own, and a
          reserved height would only open dead air around the login form. */}
      <div className="flex flex-col justify-center px-6 py-10 sm:px-10">{children}</div>

      {meta === undefined ? null : (
        <footer className="flex border-t border-marquee-border font-mono text-micro uppercase tracking-eyebrow">
          {meta.map((entry) => (
            <div
              className="border-l border-marquee-border px-6 py-4 first:border-l-0 sm:first:pl-10"
              key={entry.label}
            >
              <p className="text-marquee-muted">{entry.label}</p>
              <p className="mt-1.5 text-marquee-foreground">{entry.value}</p>
            </div>
          ))}
        </footer>
      )}

      <RegistrationMarks />
    </section>
  );
}

const MARK_CORNERS = [
  "-top-px -left-px border-t border-l",
  "-top-px -right-px border-t border-r",
  "-bottom-px -left-px border-b border-l",
  "-bottom-px -right-px border-b border-r",
] as const;

/** Corner ticks, as on a specimen plate. Decorative, and deliberately faint. */
function RegistrationMarks(): ReactNode {
  return (
    <span aria-hidden="true">
      {MARK_CORNERS.map((corner) => (
        <span className={cn("absolute size-4 border-marquee-accent/60", corner)} key={corner} />
      ))}
    </span>
  );
}
