import type { ReactElement } from "react";
import { LoaderCircle } from "lucide-react";
export function QueryLoading({ label }: { label: string }): ReactElement {
  return (
    <div role="status" className="flex items-center gap-2 text-caption text-muted-foreground">
      <LoaderCircle aria-hidden className="size-4 motion-safe:animate-spin" />
      {label}…
    </div>
  );
}
