import { PencilLoader } from "@lazuli/ui";

export function QueryLoading({ label = "Carregando" }: { label?: string }) {
  return (
    <div className="flex min-h-24 items-center justify-center gap-3 py-6" aria-busy="true">
      <PencilLoader size="sm" label={label} />
      <span className="text-caption text-muted-foreground" aria-hidden="true">
        {label}…
      </span>
    </div>
  );
}
