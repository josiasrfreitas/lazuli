import type { KeyboardEvent, ReactElement } from "react";
import type { RouterOutputs } from "@lazuli/api";
import { Badge, cn } from "@lazuli/ui";
import { Check } from "lucide-react";
import { dayLabel } from "./labels";
export type ClassMatch = RouterOutputs["admissions"]["matches"][number];
type MatchingClassesProps = {
  rows: ClassMatch[];
  selected: string;
  onSelect: (id: string) => void;
};
const directions: Record<string, number> = {
  ArrowDown: 1,
  ArrowRight: 1,
  ArrowUp: -1,
  ArrowLeft: -1,
};
function moveSelection(
  event: KeyboardEvent<HTMLButtonElement>,
  rows: ClassMatch[],
  onSelect: (id: string) => void,
): void {
  const direction = directions[event.key];
  if (!direction || rows.length === 0) return;
  event.preventDefault();
  const current = rows.findIndex((row) => row.id === event.currentTarget.dataset.classId);
  const next = rows[(current + direction + rows.length) % rows.length];
  if (!next) return;
  onSelect(next.id);
  event.currentTarget.parentElement
    ?.querySelector<HTMLButtonElement>(`[data-class-id="${next.id}"]`)
    ?.focus();
}
export function MatchingClasses({ rows, selected, onSelect }: MatchingClassesProps): ReactElement {
  return (
    <div role="radiogroup" aria-label="Turmas compatíveis" className="grid gap-2">
      {rows.map((row) => (
        <MatchChoice
          key={row.id}
          row={row}
          selected={selected === row.id}
          tabIndex={selected === row.id || (!selected && row.id === rows[0]?.id) ? 0 : -1}
          onSelect={() => onSelect(row.id)}
          onKeyDown={(event) => moveSelection(event, rows, onSelect)}
        />
      ))}
    </div>
  );
}
type MatchChoiceProps = {
  row: ClassMatch;
  selected: boolean;
  tabIndex: number;
  onSelect: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
};
function MatchChoice({
  row,
  selected,
  tabIndex,
  onSelect,
  onKeyDown,
}: MatchChoiceProps): ReactElement {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      tabIndex={tabIndex}
      data-class-id={row.id}
      onKeyDown={onKeyDown}
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-3 rounded-md border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected ? "border-primary bg-accent" : "border-border hover:bg-muted",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
          selected ? "border-primary bg-primary text-primary-foreground" : "border-border-strong",
        )}
      >
        {selected && <Check className="size-3" />}
      </span>
      <span className="grid min-w-0 flex-1 gap-1">
        <span className="break-words font-medium">{row.name}</span>
        <span className="text-caption text-muted-foreground">
          {row.slots
            .map((slot) => `${dayLabel(slot.weekday)} ${slot.startTime}–${slot.endTime}`)
            .join(" · ")}
        </span>
        <span className="text-caption text-muted-foreground">{row.semester}</span>
      </span>
      <Badge variant={row.enrolled >= row.capacity ? "warning" : "neutral"}>
        {row.enrolled}/{row.capacity}
      </Badge>
    </button>
  );
}
