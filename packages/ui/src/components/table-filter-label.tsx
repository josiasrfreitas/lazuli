"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactElement } from "react";

const PIXELS_PER_SECOND = 22;
const MINIMUM_DURATION_SECONDS = 4;

/** Measures the actual clipped distance so short labels never move. */
export function TableFilterLabel({ label }: { label: string }): ReactElement {
  const viewport = useRef<HTMLSpanElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  const [distance, setDistance] = useState(0);

  useEffect(() => {
    const measure = (): void => {
      if (!viewport.current || !text.current) return;
      setDistance(Math.max(0, text.current.scrollWidth - viewport.current.clientWidth));
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (viewport.current) observer.observe(viewport.current);
    if (text.current) observer.observe(text.current);
    return () => observer.disconnect();
  }, [label]);

  const style = {
    "--filter-label-distance": `${-distance}px`,
    "--filter-label-duration": `${Math.max(MINIMUM_DURATION_SECONDS, distance / PIXELS_PER_SECOND)}s`,
  } as CSSProperties;

  return (
    <span ref={viewport} className="lz-filter-label" title={label} style={style}>
      <span ref={text} key={label} data-overflow={distance > 0 || undefined}>
        {label}
      </span>
    </span>
  );
}
