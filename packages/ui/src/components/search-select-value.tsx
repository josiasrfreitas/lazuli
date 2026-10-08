import type { ReactElement } from "react";
import { X } from "lucide-react";
import type { SearchSelectOption } from "./search-select";
export function SelectedTags({
  value,
  onClear,
  disabled,
  touchSized = false,
}: {
  value: SearchSelectOption;
  onClear: () => void;
  disabled: boolean | undefined;
  touchSized?: boolean;
}): ReactElement {
  return (
    <div className="flex min-h-9 min-w-0 flex-wrap items-center gap-2">
      <span className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-sm bg-accent px-2 py-1 text-control text-accent-foreground">
        <span className="truncate">{value.label}</span>
        <button
          type="button"
          aria-label={`Remover ${value.label}`}
          disabled={disabled}
          onClick={onClear}
          className={
            touchSized
              ? "flex size-11 shrink-0 items-center justify-center rounded-sm hover:bg-background/60 focus-visible:outline-none focus-visible:shadow-focus sm:size-auto sm:p-0.5"
              : "shrink-0 rounded-sm p-0.5 hover:bg-background/60 focus-visible:outline-none focus-visible:shadow-focus"
          }
        >
          <X aria-hidden="true" className="size-3.5" />
        </button>
      </span>
      {value.document && (
        <span className="max-w-full truncate rounded-sm bg-accent px-2 py-1 text-control text-accent-foreground">
          {value.document}
        </span>
      )}
    </div>
  );
}
