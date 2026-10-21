import type { JSX as ReactJSX } from "react";
import { useId } from "react";
import { Button } from "@lazuli/ui";
import { Plus, X } from "lucide-react";
import { TextControl, SelectControl } from "~/features/classes/form-controls";
import { maskTime24 } from "~/lib/masks";
import { weekdays } from "./shared";

const MAX_WEEKLY_SLOTS = 7;
export type SlotDraft = { weekday: keyof typeof weekdays; startTime: string; endTime: string };
export function SlotFields({
  slots,
  onChange,
  error,
}: {
  slots: SlotDraft[];
  onChange: (slots: SlotDraft[]) => void;
  error?: string | undefined;
}): ReactJSX.Element {
  const errorId = useId();
  const update = (index: number, field: keyof SlotDraft, value: string): void =>
    onChange(
      slots.map((slot, position) => (position === index ? { ...slot, [field]: value } : slot)),
    );
  return (
    <fieldset
      className="grid gap-3"
      aria-invalid={Boolean(error)}
      aria-describedby={error ? errorId : undefined}
    >
      <legend className="mb-2 text-caption font-medium">Horários da semana</legend>
      {slots.map((slot, index) => (
        <div key={index} className="grid gap-2 sm:flex sm:items-end">
          <div className="min-w-0 flex-1">
            <SelectControl
              name={`slot-day-${index}`}
              label={`Dia ${index + 1}`}
              value={slot.weekday}
              onChange={(value) => update(index, "weekday", value)}
              choices={Object.entries(weekdays).map(([value, label]) => ({ value, label }))}
            />
          </div>
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1 sm:w-24 sm:flex-none">
              <TextControl
                name={`slot-start-${index}`}
                label="Início"
                value={slot.startTime}
                placeholder="14:00"
                inputMode="numeric"
                onChange={(value) => update(index, "startTime", maskTime24(value))}
              />
            </div>
            <div className="min-w-0 flex-1 sm:w-24 sm:flex-none">
              <TextControl
                name={`slot-end-${index}`}
                label="Fim"
                value={slot.endTime}
                placeholder="15:00"
                inputMode="numeric"
                onChange={(value) => update(index, "endTime", maskTime24(value))}
              />
            </div>
            <div className="self-end pb-0.5">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remover horário ${index + 1}`}
                disabled={slots.length === 1}
                onClick={() => onChange(slots.filter((_unused, position) => position !== index))}
              >
                <X />
              </Button>
            </div>
          </div>
        </div>
      ))}
      {error && (
        <p id={errorId} role="alert" className="text-caption text-destructive">
          {error}
        </p>
      )}
      <div>
        <Button
          variant="secondary"
          size="sm"
          disabled={slots.length >= MAX_WEEKLY_SLOTS}
          onClick={() => onChange([...slots, { weekday: "WEDNESDAY", startTime: "", endTime: "" }])}
        >
          <Plus />
          Adicionar horário
        </Button>
      </div>
    </fieldset>
  );
}
