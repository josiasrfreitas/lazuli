import { InlineSkeleton } from "@lazuli/ui";

export function StageLoading(): React.JSX.Element {
  return (
    <div aria-label="Carregando catálogo" aria-busy="true" className="grid gap-4 py-3">
      <InlineSkeleton className="h-6 w-32" />
      <InlineSkeleton className="h-4 w-56" />
      <InlineSkeleton className="h-10 w-full" />
      <InlineSkeleton className="h-10 w-full" />
    </div>
  );
}
