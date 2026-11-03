import type { ReactElement } from "react";
import { InlineSkeleton } from "@lazuli/ui";

const CHART_GUIDES = 5;
const AXIS_LABELS = 4;

/** Mirrors the chart-first modal rather than the grade editor. */
export function StudentProgressLoading(): ReactElement {
  return (
    <div role="status" aria-busy="true" className="grid min-w-0 gap-5">
      <span className="sr-only">Carregando evolução das notas</span>
      <div aria-hidden="true" className="flex justify-end">
        <InlineSkeleton className="h-10 w-36 rounded-md" />
      </div>
      <div aria-hidden="true" className="grid gap-4">
        <InlineSkeleton className="h-4 w-36" />
        <div className="flex h-72 flex-col justify-between border-b border-l border-border px-4 py-3">
          {Array.from({ length: CHART_GUIDES }, (_value, line) => (
            <InlineSkeleton key={line} className="h-px w-full rounded-none" />
          ))}
        </div>
        <div className="flex justify-around gap-4">
          <InlineSkeleton className="h-3 w-16" />
          <InlineSkeleton className="h-3 w-16" />
        </div>
        <div className="flex flex-wrap justify-center gap-4">
          {Array.from({ length: AXIS_LABELS }, (_value, item) => (
            <InlineSkeleton key={item} className="h-3 w-16" />
          ))}
        </div>
      </div>
    </div>
  );
}
