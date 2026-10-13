"use client";

import type { ReactElement, ReactNode } from "react";
import Link from "next/link";

/** Loaded profile records are immediately available in a bounded scroll region. */
export function ProfileRecordList({
  children,
  total,
  label,
  historyHref,
}: {
  children: ReactNode[];
  total: number;
  label: string;
  historyHref?: string;
}): ReactElement {
  return (
    <div className="grid min-w-0 gap-3">
      <div
        role="region"
        aria-label={label}
        tabIndex={0}
        className="scrollbar-subtle h-96 min-w-0 overflow-y-auto overscroll-y-contain px-1 focus-visible:outline-2 focus-visible:outline-ring"
      >
        <ul className="divide-y divide-border">{children}</ul>
      </div>
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <p className="text-caption text-muted-foreground" aria-live="polite">
          Exibindo {children.length} de {total}
          {children.length < total && historyHref && (
            <>
              {" "}
              ·{" "}
              <Link
                href={historyHref}
                className="text-interactive underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
              >
                Ver todos
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
