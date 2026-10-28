import type { ReactElement } from "react";
import { InlineSkeleton } from "@lazuli/ui";

const PAYMENT_LOADING_ROWS = 4;

export function FinancialDialogLoading({
  termination = false,
}: {
  termination?: boolean;
}): ReactElement {
  return (
    <div role="status" aria-busy="true" className="grid min-w-0 gap-5 py-4">
      <span className="sr-only">
        {termination ? "Calculando valores da rescisão" : "Carregando parcelas para negociação"}
      </span>
      {termination && <InlineSkeleton aria-hidden="true" className="h-16 w-full rounded-md" />}
      <div aria-hidden="true" className="grid min-w-0 gap-6 md:grid-cols-2">
        <div className="grid content-start gap-3">
          <InlineSkeleton className="h-4 w-36" />
          {Array.from({ length: PAYMENT_LOADING_ROWS }, (_value, row) => (
            <div
              key={row}
              className="flex items-center justify-between gap-4 border-b border-border py-3"
            >
              <InlineSkeleton className="h-4 w-28" />
              <InlineSkeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
        <div className="grid content-start gap-4">
          <InlineSkeleton className="h-4 w-40" />
          {[0, 1].map((field) => (
            <div key={field} className="grid gap-2">
              <InlineSkeleton className="h-3 w-24" />
              <InlineSkeleton className="h-10 w-full rounded-md" />
            </div>
          ))}
          <InlineSkeleton className="h-12 w-full rounded-md" />
        </div>
      </div>
    </div>
  );
}
