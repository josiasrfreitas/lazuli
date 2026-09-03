"use client";

import type { ReactElement, ReactNode } from "react";

import { ScrollArea } from "@base-ui/react/scroll-area";

import { cn } from "../lib/utils";

// The viewport-bound frame draws its own scrollbar instead of relying on the
// browser's: a native one spans the whole scroll container, sticky header
// included, while this one is confined to the data (`--lz-table-scrollbar-top`
// is set by `data-table-frame`). Its look mirrors `scrollbar-subtle`.
const scrollbarClassName =
  "bg-scrollbar-track data-[orientation=horizontal]:h-2 data-[orientation=vertical]:w-2";
const thumbClassName = cn(
  "rounded-full border-2 border-transparent bg-scrollbar-thumb bg-clip-padding",
  "hover:bg-scrollbar-thumb-hover",
  "data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full",
);

/**
 * The scroll region of a viewport-bound `TableContainer`. Only the table
 * inside it moves; the frame's footer is rendered by the container itself.
 */
export function TableScrollArea({ children }: { children: ReactNode }): ReactElement {
  return (
    <ScrollArea.Root
      className="relative flex min-h-0 flex-1 flex-col"
      data-slot="table-scroll-area"
    >
      <ScrollArea.Viewport
        // `relative` anchors absolutely-positioned descendants (e.g. `sr-only`
        // labels in cells) inside the scroll area; without it they sit on the
        // page itself, widening it by the table's off-screen width.
        // `overscroll-none` stops the rubber-band bounce at the ends of the data.
        className="relative min-h-0 flex-1 overscroll-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
        data-slot="table-viewport"
      >
        {children}
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar
        className={scrollbarClassName}
        orientation="vertical"
        style={{ top: "var(--lz-table-scrollbar-top)" }}
      >
        <ScrollArea.Thumb className={thumbClassName} />
      </ScrollArea.Scrollbar>
      <ScrollArea.Scrollbar className={scrollbarClassName} orientation="horizontal">
        <ScrollArea.Thumb className={thumbClassName} />
      </ScrollArea.Scrollbar>
      <ScrollArea.Corner className="bg-card" />
    </ScrollArea.Root>
  );
}
