import type { JSX as ReactJSX } from "react";
import { InlineSkeleton } from "@lazuli/ui";

export function FormFieldLoading({
  label,
  size = "sm",
}: {
  label: string;
  size?: "sm" | "md";
}): ReactJSX.Element {
  return (
    <div className="grid gap-2" role="status" aria-label={`Carregando ${label.toLowerCase()}`}>
      <span className="text-sm font-medium">{label}</span>
      <InlineSkeleton
        className={size === "sm" ? "h-8 w-full rounded-md" : "h-10 w-full rounded-md"}
      />
    </div>
  );
}
