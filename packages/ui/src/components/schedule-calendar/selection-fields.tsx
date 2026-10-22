"use client";
import { useId, useState, type ReactElement } from "react";
import { Clock3 } from "lucide-react";
import { Button } from "../button";
import { Input } from "../input";
import { Label } from "../label";
import { Field } from "../field";
import type { CalendarInterval, CalendarRangeSelection } from "./types";
import { selectionError } from "./model";

type SelectionFieldsProps = {
  date: string;
  minDate?: string | undefined;
  maxDate?: string | undefined;
  selection: CalendarRangeSelection;
  disabled: boolean;
  onSelect: (range: CalendarInterval) => void;
};

export function CalendarSelectionFields({
  date,
  minDate,
  maxDate,
  selection,
  disabled,
  onSelect,
}: SelectionFieldsProps): ReactElement {
  const id = useId();
  const [draft, setDraft] = useState<CalendarInterval>(
    selection.value ?? { date, startTime: "", endTime: "" },
  );
  const [submitted, setSubmitted] = useState(false);
  const error = selectionError(draft, selection);
  return (
    <div className="lz-calendar-selection-fields">
      {(["date", "startTime", "endTime"] as const).map((name) => (
        <SelectionField
          key={name}
          name={name}
          id={id}
          selection={selection}
          minDate={minDate}
          maxDate={maxDate}
          draft={draft}
          disabled={disabled}
          onChange={setDraft}
        />
      ))}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={disabled}
        onClick={() => {
          setSubmitted(true);
          if (!error) onSelect(draft);
        }}
      >
        <Clock3 />
        Selecionar horário
      </Button>
      {submitted && error && <p role="alert">{error}</p>}
    </div>
  );
}

function SelectionField({
  name,
  minDate,
  maxDate,
  id,
  selection,
  draft,
  disabled,
  onChange,
}: {
  name: keyof CalendarInterval;
  minDate?: string | undefined;
  maxDate?: string | undefined;
  id: string;
  selection: CalendarRangeSelection;
  draft: CalendarInterval;
  disabled: boolean;
  onChange: (range: CalendarInterval) => void;
}): ReactElement {
  const field = new Map([
    ["date", { label: "Data", value: draft.date }],
    ["startTime", { label: "Início", value: draft.startTime }],
    ["endTime", { label: "Fim", value: draft.endTime }],
  ]).get(name)!;
  return (
    <Field>
      <Label htmlFor={`${id}-${name}`}>{field.label}</Label>
      <Input
        id={`${id}-${name}`}
        type={name === "date" ? "date" : "time"}
        size="sm"
        min={
          name === "date"
            ? [minDate, selection.minimum?.date].filter(Boolean).toSorted().at(-1)
            : undefined
        }
        max={name === "date" ? maxDate : undefined}
        value={field.value}
        disabled={disabled}
        onChange={(event) => onChange({ ...draft, [name]: event.target.value })}
      />
    </Field>
  );
}
