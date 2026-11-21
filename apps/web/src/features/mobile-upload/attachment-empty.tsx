import type { ReactElement, ReactNode } from "react";
import { Paperclip } from "lucide-react";

export function AttachmentEmpty({ children }: { children: ReactNode }): ReactElement {
  return (
    <div className="grid justify-items-center gap-3 rounded-lg border border-dashed border-border-strong bg-card p-5 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-accent text-accent-foreground">
        <Paperclip aria-hidden="true" />
      </span>
      <p className="text-caption text-muted-foreground">
        Este clipe está procurando seu primeiro arquivo.
      </p>
      {children}
    </div>
  );
}
