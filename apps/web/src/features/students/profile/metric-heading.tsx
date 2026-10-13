import type { ReactElement, ReactNode } from "react";
import { Info } from "lucide-react";
import { Button, Popover, PopoverContent, PopoverTrigger } from "@lazuli/ui";

export function MetricHeading({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}): ReactElement {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-sm font-medium text-muted-foreground">{label}</h3>
      <Popover>
        <PopoverTrigger
          aria-label={`Sobre ${label.toLocaleLowerCase("pt-BR")}`}
          render={<Button variant="text" size="icon-sm" />}
        >
          <Info aria-hidden="true" className="size-3.5" />
        </PopoverTrigger>
        <PopoverContent size="md" align="end">
          <p className="leading-relaxed">{children}</p>
        </PopoverContent>
      </Popover>
    </div>
  );
}
