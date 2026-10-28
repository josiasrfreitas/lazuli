import type { ReactElement } from "react";
import { DialogHeader, DialogTitle, DialogFooter, InlineSkeleton } from "@lazuli/ui";

export function AppointmentLoadingHeader(): ReactElement {
  return (
    <DialogHeader>
      <DialogTitle>
        <span className="sr-only">Carregando atendimento</span>
        <InlineSkeleton className="h-6 w-56 max-w-full" aria-hidden="true" />
      </DialogTitle>
      <div className="flex flex-wrap gap-4 border-b border-border py-3" aria-hidden="true">
        <InlineSkeleton className="h-3 w-36" />
        <InlineSkeleton className="h-3 w-32" />
        <InlineSkeleton className="h-3 w-28" />
      </div>
    </DialogHeader>
  );
}

export function AppointmentLoadingBody(): ReactElement {
  return (
    <div role="status" aria-busy="true" className="grid gap-6 py-2">
      <span className="sr-only">Carregando detalhes do atendimento</span>
      {[0, 1].map((section) => (
        <div key={section} className="grid gap-3" aria-hidden="true">
          <InlineSkeleton className="h-4 w-48 max-w-full" />
          <InlineSkeleton className="h-3 w-full" />
          <InlineSkeleton className="h-3 w-4/5" />
          <InlineSkeleton className="h-3 w-3/5" />
        </div>
      ))}
    </div>
  );
}

export function AppointmentLoadingFooter(): ReactElement {
  return (
    <DialogFooter>
      <div
        aria-hidden="true"
        className="flex w-full flex-wrap justify-between gap-3 border-t border-border pt-4"
      >
        <InlineSkeleton className="h-8 w-28 rounded-sm" />
        <InlineSkeleton className="h-8 w-44 rounded-sm" />
      </div>
    </DialogFooter>
  );
}
