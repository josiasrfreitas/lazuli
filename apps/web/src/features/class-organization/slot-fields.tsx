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
  const update = ({
    index,
    field,
    value,
  }: {
    index: number;
    field: keyof SlotDraft;
    value: string;
  }): void =>
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
      <SlotRows slots={slots} onChange={onChange} onUpdate={update} />
      {error && (
        <p id={errorId} role="alert" className="text-caption text-destructive">
          {error}
        </p>
      )}
      <AddSlotButton
        disabled={slots.length >= MAX_WEEKLY_SLOTS}
        onAdd={() => onChange([...slots, { weekday: "WEDNESDAY", startTime: "", endTime: "" }])}
      />
    </fieldset>
  );
}

function SlotRows({
  slots,
  onChange,
  onUpdate,
}: {
  slots: SlotDraft[];
  onChange: (slots: SlotDraft[]) => void;
  onUpdate: (change: { index: number; field: keyof SlotDraft; value: string }) => void;
}): ReactJSX.Element {
  return (
    <>
      {slots.map((slot, index) => (
        <SlotRow
          key={index}
          slot={slot}
          index={index}
          removable={slots.length > 1}
          onUpdate={(field, value) => onUpdate({ index, field, value })}
          onRemove={() => onChange(slots.filter((_unused, position) => position !== index))}
        />
      ))}
    </>
  );
}

function AddSlotButton({
  disabled,
  onAdd,
}: {
  disabled: boolean;
  onAdd: () => void;
}): ReactJSX.Element {
  return (
    <div>
      <Button variant="secondary" size="sm" disabled={disabled} onClick={onAdd}>
        <Plus />
        Adicionar horário
      </Button>
    </div>
  );
}

function SlotRow({
  slot,
  index,
  removable,
  onUpdate,
  onRemove,
}: {
  slot: SlotDraft;
  index: number;
  removable: boolean;
  onUpdate: (field: keyof SlotDraft, value: string) => void;
  onRemove: () => void;
}): ReactJSX.Element {
  return (
    <div className="grid gap-2 sm:flex sm:items-end">
      <div className="min-w-0 flex-1">
        <SelectControl
          name={`slot-day-${index}`}
          label={`Dia ${index + 1}`}
          value={slot.weekday}
          onChange={(value) => onUpdate("weekday", value)}
          choices={Object.entries(weekdays).map(([value, label]) => ({ value, label }))}
        />
      </div>
      <div className="flex items-end gap-2">
        <SlotTimeControl
          name={`slot-start-${index}`}
          label="Início"
          value={slot.startTime}
          placeholder="14:00"
          onChange={(value) => onUpdate("startTime", value)}
        />
        <SlotTimeControl
          name={`slot-end-${index}`}
          label="Fim"
          value={slot.endTime}
          placeholder="15:00"
          onChange={(value) => onUpdate("endTime", value)}
        />
        <RemoveSlotButton index={index} removable={removable} onRemove={onRemove} />
      </div>
    </div>
  );
}

function RemoveSlotButton({
  index,
  removable,
  onRemove,
}: {
  index: number;
  removable: boolean;
  onRemove: () => void;
}): ReactJSX.Element {
  return (
    <div className="self-end pb-0.5">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Remover horário ${index + 1}`}
        disabled={!removable}
        onClick={onRemove}
      >
        <X />
      </Button>
    </div>
  );
}

function SlotTimeControl({
  name,
  label,
  value,
  placeholder,
  onChange,
}: {
  name: string;
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}): ReactJSX.Element {
  return (
    <div className="min-w-0 flex-1 sm:w-24 sm:flex-none">
      <TextControl
        name={name}
        label={label}
        value={value}
        placeholder={placeholder}
        inputMode="numeric"
        onChange={(next) => onChange(maskTime24(next))}
      />
    </div>
  );
}
