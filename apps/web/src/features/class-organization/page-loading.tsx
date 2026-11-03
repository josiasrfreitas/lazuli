import type { JSX as ReactJSX } from "react";
import { InlineSkeleton } from "@lazuli/ui";

export function OrganizationLoading(): ReactJSX.Element {
  return (
    <div
      className="flex min-h-0 flex-1 gap-4 overflow-hidden p-4"
      role="status"
      aria-label="Carregando organização"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {Array.from({ length: 4 }, (_unused, position) => (
          <InlineSkeleton key={position} className="h-24 w-full shrink-0" />
        ))}
      </div>
      <span className="sr-only">Carregando turmas e alunos…</span>
    </div>
  );
}
