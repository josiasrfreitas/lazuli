"use client";
import { useRef, type ReactElement } from "react";
import { Button, FormRow } from "@lazuli/ui";
import { X } from "lucide-react";
import { maskTime24 } from "~/lib/masks";
import { emptyClassSlot } from "./create-model";
import type { ClassFieldsProps } from "./create-fields";
import { SelectControl, TextControl } from "./form-controls";
import { updateScheduleDraft } from "./schedule-draft";

const WEEKDAY_CHOICES = [
  { value: "MONDAY", label: "Segunda" },
  { value: "TUESDAY", label: "Terça" },
  { value: "WEDNESDAY", label: "Quarta" },
  { value: "THURSDAY", label: "Quinta" },
  { value: "FRIDAY", label: "Sexta" },
  { value: "SATURDAY", label: "Sábado" },
  { value: "SUNDAY", label: "Domingo" },
];
type Slot = ClassFieldsProps["draft"]["slots"][number];
type SlotProps = {
  slot: Slot;
  index: number;
  update: (value: Slot) => void;
  remove: () => void;
  error?: string | undefined;
};
function SlotInputs({
  slot,
  index,
  update,
  error,
}: Pick<SlotProps, "slot" | "index" | "update" | "error">): ReactElement {
  return (
    <FormRow columns={3}>
      <SelectControl
        name={`weekday-${index}`}
        label="Dia"
        hideLabel
        value={slot.weekday}
        onChange={(value) => update({ ...slot, weekday: value as Slot["weekday"] })}
        choices={WEEKDAY_CHOICES}
      />
      <TextControl
        name={`startTime-${index}`}
        label="Início"
        placeholder="19:00"
        value={slot.startTime}
        onChange={(value) => update({ ...slot, startTime: maskTime24(value) })}
        inputMode="numeric"
        invalid={Boolean(error)}
      />
      <TextControl
        name={`endTime-${index}`}
        label="Fim"
        placeholder="20:30"
        value={slot.endTime}
        onChange={(value) => update({ ...slot, endTime: maskTime24(value) })}
        inputMode="numeric"
        invalid={Boolean(error)}
      />
    </FormRow>
  );
}
function SlotFields(props: SlotProps): ReactElement {
  return (
    <div className="flex items-end gap-2">
      <div className="min-w-0 flex-1">
        <SlotInputs
          slot={props.slot}
          index={props.index}
          update={props.update}
          error={props.error}
        />
      </div>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        onClick={props.remove}
        aria-label={`Limpar horário ${props.index + 1}`}
      >
        <X aria-hidden="true" className="size-4" />
      </Button>
    </div>
  );
}
export function ScheduleFields(props: ClassFieldsProps): ReactElement {
  const { draft, change, errors } = props;
  const autoFillUsed = useRef(false);
  function updateSlot(index: number, value: Slot): void {
    const next = updateScheduleDraft({
      slots: draft.slots,
      index,
      value,
      autoFillUsed: autoFillUsed.current,
    });
    autoFillUsed.current = next.autoFillUsed;
    change("slots", next.slots);
  }
  return (
    <>
      {draft.slots.map((slot, index) => (
        <SlotFields
          key={index}
          slot={slot}
          index={index}
          error={errors.slots}
          update={(value) => updateSlot(index, value)}
          remove={() =>
            draft.slots.length > 2
              ? change(
                  "slots",
                  draft.slots.filter((...entry) => entry[1] !== index),
                )
              : updateSlot(index, emptyClassSlot())
          }
        />
      ))}
      {errors.slots && (
        <p role="alert" className="text-caption text-destructive">
          {errors.slots}
        </p>
      )}
      <p className="text-caption text-muted-foreground">
        Até 2 horas por semana · formato 24h (HH:mm).
      </p>
    </>
  );
}
