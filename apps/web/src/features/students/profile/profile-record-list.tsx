"use client";

import { useId, useRef, useState, type ReactElement, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@lazuli/ui";

/** A profile preview stays bounded even when the reader opens the loaded history. */
export function ProfileRecordList({
  children,
  total,
  label,
  previewCount = 3,
  historyHref,
}: {
  children: ReactNode[];
  total: number;
  label: string;
  previewCount?: number;
  historyHref?: string;
}): ReactElement {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const viewport = useRef<HTMLDivElement>(null);
  const visible = expanded ? children : children.slice(0, previewCount);
  return (
    <div className="grid min-w-0 gap-3">
      <div
        id={id}
        ref={viewport}
        role="region"
        aria-label={label}
        tabIndex={0}
        className="scrollbar-subtle max-h-96 min-w-0 overflow-y-auto overscroll-y-contain px-1 focus-visible:outline-2 focus-visible:outline-ring"
      >
        <ul className="divide-y divide-border">{visible}</ul>
      </div>
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <p className="text-caption text-muted-foreground" aria-live="polite">
          Exibindo {visible.length} de {total}
          {expanded && visible.length < total && historyHref && (
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
        {children.length > previewCount && (
          <Button
            variant="link"
            size="inline"
            aria-controls={id}
            aria-expanded={expanded}
            onClick={() => {
              setExpanded(!expanded);
              viewport.current?.scrollTo({ top: 0 });
            }}
          >
            {expanded ? "Ver menos" : "Ver mais"}
            {expanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
          </Button>
        )}
      </div>
    </div>
  );
}
