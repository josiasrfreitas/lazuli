import type { ComponentPropsWithoutRef, ReactElement, ReactNode } from "react";

import { cn } from "../lib/utils";
import { InlineSkeleton } from "./inline-skeleton";

export type TimelineLayout = "single" | "alternating";

export type TimelineItem = {
  id: string;
  /** Decorative marker. Put its meaning in the title or metadata as well. */
  icon?: ReactNode;
  title: ReactNode;
  /** Pass a time element with dateTime for machine-readable dates. */
  timestamp?: ReactNode;
  metadata?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
};

export type TimelineGroup = {
  id: string;
  label: string;
  description?: ReactNode;
  items: readonly TimelineItem[];
};

export type TimelineProps = Omit<ComponentPropsWithoutRef<"div">, "children"> & {
  /** Groups and items render in the supplied order, including in the DOM. */
  groups: readonly TimelineGroup[];
  /** Alternation applies only when the component has enough available width. */
  layout?: TimelineLayout;
  emptyState?: ReactNode;
};

/** Chronological content. The caller owns grouping, dates, fetching and pagination. */
export function Timeline({
  groups,
  layout = "single",
  emptyState,
  className,
  ...props
}: TimelineProps): ReactElement {
  const visibleGroups = groups.filter((group) => group.items.length > 0);
  return (
    <div
      {...props}
      data-slot="timeline"
      data-layout={layout}
      className={cn("lz-timeline", className)}
    >
      {visibleGroups.length === 0
        ? emptyState
        : visibleGroups.map((group) => (
            <section key={group.id} aria-label={group.label} className="lz-timeline-group">
              <header className="lz-timeline-heading">
                {group.label && <h2>{group.label}</h2>}
                {group.description && <span>{group.description}</span>}
              </header>
              <ol className="lz-timeline-list" aria-label={group.label}>
                {group.items.map((item) => (
                  <li key={item.id} className="lz-timeline-item" data-timeline-id={item.id}>
                    <span className="lz-timeline-marker" aria-hidden="true">
                      {item.icon}
                    </span>
                    <article className="lz-timeline-card">
                      {(item.metadata || item.timestamp) && (
                        <div className="lz-timeline-meta">
                          {item.metadata}
                          {item.timestamp && (
                            <span className="lz-timeline-time">{item.timestamp}</span>
                          )}
                        </div>
                      )}
                      <h3 className="lz-timeline-title">{item.title}</h3>
                      {item.children && <div className="lz-timeline-content">{item.children}</div>}
                      {item.footer && <footer className="lz-timeline-footer">{item.footer}</footer>}
                    </article>
                  </li>
                ))}
              </ol>
            </section>
          ))}
    </div>
  );
}

export type TimelineSkeletonProps = {
  layout?: TimelineLayout;
  label?: string;
};

export function TimelineSkeleton({
  layout = "single",
  label = "Carregando atividades",
}: TimelineSkeletonProps): ReactElement {
  return (
    <div role="status" aria-label={label}>
      <Timeline
        aria-hidden="true"
        layout={layout}
        groups={[
          {
            id: "loading",
            label: "",
            description: <InlineSkeleton className="w-32" />,
            items: Array.from({ length: 3 }, (_unused, index) => ({
              id: String(index),
              title: <InlineSkeleton className="h-5 w-3/4" />,
              metadata: <InlineSkeleton className="w-20" />,
              timestamp: <InlineSkeleton className="w-10" />,
              children: <InlineSkeleton className="w-1/2" />,
              footer: <InlineSkeleton className="w-28" />,
            })),
          },
        ]}
      />
    </div>
  );
}
