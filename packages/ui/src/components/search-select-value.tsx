import type { ReactElement } from "react";
import { X } from "lucide-react";
import { Badge } from "./badge";
import type { SearchSelectOption } from "./search-select";

/** Input-sized selected value; clearing stays available to keyboard and touch users. */
export function SelectionValue({
  value,
  onClear,
  disabled,
  clearLabel = "Limpar seleção e campos preenchidos",
  touchSized = false,
}: {
  value: string;
  onClear?: (() => void) | undefined;
  disabled?: boolean | undefined;
  clearLabel?: string;
  touchSized?: boolean;
}): ReactElement {
  return (
    <Badge
      size="field"
      className={touchSized ? "group/selection gap-2 max-sm:h-11" : "group/selection gap-2"}
    >
      <span className="min-w-0 flex-1 truncate" title={value || "Não informado"}>
        {value || "Não informado"}
      </span>
      {onClear && (
        <button
          type="button"
          aria-label={clearLabel}
          disabled={disabled}
          onClick={onClear}
          className="flex size-6 shrink-0 items-center justify-center rounded-sm transition-opacity hover:bg-background/60 focus-visible:outline-none focus-visible:shadow-focus [@media(hover:hover)]:opacity-0 group-hover/selection:opacity-100 group-focus-within/selection:opacity-100 disabled:pointer-events-none disabled:opacity-disabled"
        >
          <X aria-hidden="true" className="size-3.5" />
        </button>
      )}
    </Badge>
  );
}

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
    <div className="grid min-w-0 gap-2">
      <SelectionValue
        value={value.label}
        onClear={onClear}
        clearLabel={`Remover ${value.label}`}
        disabled={disabled}
        touchSized={touchSized}
      />
      {value.document && <SelectionValue value={value.document} />}
    </div>
  );
}
