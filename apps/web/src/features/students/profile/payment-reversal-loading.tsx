import type { ReactElement } from "react";
import { InlineSkeleton } from "@lazuli/ui";

export function PaymentChoicesLoading(): ReactElement {
  return (
    <div className="grid gap-2" role="status" aria-busy="true">
      <span className="sr-only">Carregando recebimentos…</span>
      {Array.from({ length: 7 }, (_value, index) => (
        <div key={index} className="grid gap-2 rounded-md border border-border p-2.5">
          <div className="flex justify-between gap-2">
            <InlineSkeleton className="h-3 w-14" />
            <InlineSkeleton className="h-3 w-14" />
          </div>
          <InlineSkeleton className="h-3 w-28 max-w-full" />
        </div>
      ))}
    </div>
  );
}

export function PaymentReversalLoading(): ReactElement {
  return (
    <div
      className="grid min-h-80 min-w-0 content-start gap-4 md:min-h-88"
      role="status"
      aria-busy="true"
    >
      <span className="sr-only">Carregando parcelas…</span>
      <div className="grid min-w-0 gap-2">
        <InlineSkeleton className="h-8 w-56 max-w-full" />
        <InlineSkeleton className="h-3 w-full max-w-80" />
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <div className="grid min-w-0 gap-4">
          <div className="grid gap-3">
            <InlineSkeleton className="h-4 w-44 max-w-full" />
            <div className="flex items-center justify-between gap-3">
              <div className="grid min-w-0 gap-2">
                <InlineSkeleton className="h-3 w-16" />
                <InlineSkeleton className="h-3 w-40 max-w-full" />
              </div>
              <InlineSkeleton shape="block" className="h-8 w-28" />
            </div>
          </div>
          <div className="grid gap-2">
            <InlineSkeleton className="h-3 w-32 max-w-full" />
            <InlineSkeleton shape="block" className="h-16 w-full" />
          </div>
        </div>
        <div className="grid min-w-0 gap-3 border-t border-border pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-5">
          <InlineSkeleton className="h-4 w-36 max-w-full" />
          <div className="grid grid-cols-2 gap-3">
            <LoadingField />
            <LoadingField />
          </div>
          <LoadingField />
          <InlineSkeleton className="h-8 w-48 max-w-full" />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <div className="grid gap-2">
          <InlineSkeleton className="h-3 w-24" />
          <InlineSkeleton className="h-6 w-28" />
        </div>
        <InlineSkeleton shape="block" className="h-8 w-44 max-w-full" />
      </div>
    </div>
  );
}

function LoadingField(): ReactElement {
  return (
    <div className="grid min-w-0 gap-2">
      <InlineSkeleton className="h-3 w-24 max-w-full" />
      <InlineSkeleton shape="block" className="h-8 w-full" />
    </div>
  );
}
