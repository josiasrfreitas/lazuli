"use client";
import type { ReactElement } from "react";
import { Button, FormRow } from "@lazuli/ui";
import type { ClassFieldsProps } from "./create-fields";
import { NativeSelect, TextControl } from "./form-controls";

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
  removable: boolean;
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
      <NativeSelect
        name={`weekday-${index}`}
        label="Dia"
        value={slot.weekday}
        onChange={(value) => update({ ...slot, weekday: value as Slot["weekday"] })}
        choices={WEEKDAY_CHOICES}
      />
      <TextControl
        name={`startTime-${index}`}
        label="Início"
        placeholder="14:00"
        value={slot.startTime}
        onChange={(value) => update({ ...slot, startTime: value })}
        error={error}
      />
      <TextControl
        name={`endTime-${index}`}
        label="Fim"
        placeholder="15:00"
        value={slot.endTime}
        onChange={(value) => update({ ...slot, endTime: value })}
        error={error}
      />
    </FormRow>
  );
}
function SlotFields(props: SlotProps): ReactElement {
  return (
    <div className="space-y-2 border-t border-border pt-3">
      <div className="flex items-center justify-between">
        <p className="text-caption font-semibold">Horário {props.index + 1}</p>
        {props.removable && (
          <Button type="button" size="sm" variant="secondary" onClick={props.remove}>
            Remover
          </Button>
        )}
      </div>
      <SlotInputs slot={props.slot} index={props.index} update={props.update} error={props.error} />
    </div>
  );
}
function YearCapacityFields({ draft, change, errors }: ClassFieldsProps): ReactElement {
  return (
    <FormRow columns={2}>
      <TextControl
        name="year"
        label="Ano"
        placeholder="2026"
        value={draft.year}
        onChange={(value) => change("year", value)}
        error={errors.year}
        inputMode="numeric"
      />
      <TextControl
        name="capacity"
        label="Capacidade de referência"
        placeholder="12"
        value={draft.capacity}
        onChange={(value) => change("capacity", value)}
        error={errors.capacity}
        inputMode="numeric"
      />
    </FormRow>
  );
}
export function ScheduleFields(props: ClassFieldsProps): ReactElement {
  const { draft, change, errors } = props;
  function updateSlot(index: number, value: Slot): void {
    change(
      "slots",
      draft.slots.map((slot, slotIndex) => (slotIndex === index ? value : slot)),
    );
  }
  return (
    <>
      <YearCapacityFields {...props} />
      {draft.slots.map((slot, index) => (
        <SlotFields
          key={`${slot.weekday}-${index}`}
          slot={slot}
          index={index}
          update={(value) => updateSlot(index, value)}
          remove={() =>
            change(
              "slots",
              draft.slots.filter((...entry) => entry[1] !== index),
            )
          }
          removable={draft.slots.length > 1}
          error={errors.slots}
        />
      ))}
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={() =>
          change("slots", [
            ...draft.slots,
            { weekday: "MONDAY", startTime: "14:00", endTime: "15:00" },
          ])
        }
      >
        Adicionar horário
      </Button>
    </>
  );
}
