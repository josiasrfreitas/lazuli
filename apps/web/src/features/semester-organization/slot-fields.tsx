import { Button, FieldError } from "@lazuli/ui";
import { Plus, X } from "lucide-react";
import { TextControl, SelectControl } from "~/features/classes/form-controls";
import { maskTime24 } from "~/lib/masks";
import { weekdays } from "./shared";
export type SlotDraft = { weekday: keyof typeof weekdays; startTime: string; endTime: string };
export function SlotFields({
  slots,
  onChange,
  error,
}: {
  slots: SlotDraft[];
  onChange: (slots: SlotDraft[]) => void;
  error?: string | undefined;
}) {
  const update = (index: number, field: keyof SlotDraft, value: string) =>
    onChange(slots.map((slot, i) => (i === index ? { ...slot, [field]: value } : slot)));
  return (
    <fieldset className="grid gap-3">
      <legend className="mb-2 text-caption font-medium">Horários da semana</legend>
      {slots.map((slot, index) => (
        <div key={index} className="flex flex-wrap items-start gap-2">
          <div className="min-w-28 flex-1">
            <SelectControl
              name={`slot-day-${index}`}
              label={`Dia ${index + 1}`}
              value={slot.weekday}
              onChange={(value) => update(index, "weekday", value)}
              choices={Object.entries(weekdays).map(([value, label]) => ({ value, label }))}
            />
          </div>
          <div className="w-24">
            <TextControl
              name={`slot-start-${index}`}
              label="Início"
              value={slot.startTime}
              placeholder="14:00"
              inputMode="numeric"
              onChange={(value) => update(index, "startTime", maskTime24(value))}
            />
          </div>
          <div className="w-24">
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
              onClick={() => onChange(slots.filter((_, i) => i !== index))}
            >
              <X />
            </Button>
          </div>
        </div>
      ))}
      <FieldError match={Boolean(error)}>{error}</FieldError>
      <div>
        <Button
          variant="secondary"
          size="sm"
          disabled={slots.length >= 7}
          onClick={() => onChange([...slots, { weekday: "WEDNESDAY", startTime: "", endTime: "" }])}
        >
          <Plus />
          Adicionar horário
        </Button>
      </div>
    </fieldset>
  );
}
