import { Field, Label, SegmentedControl, SegmentedControlItem } from "@lazuli/ui";
import type { AppointmentSnapshot } from "@lazuli/validators";
import { TextControl } from "~/features/classes/form-controls";
import { NarrativeField } from "~/features/shared/task-form";
import { maskDateBR, maskTime24 } from "~/lib/masks";
import { purposes } from "./shared";

function Choices({
  name,
  label,
  value,
  options,
  onChange,
}: {
  name: string;
  label: string;
  value: string;
  options: Record<string, string>;
  onChange: (value: string) => void;
}) {
  return (
    <Field>
      <Label id={`${name}-label`}>{label}</Label>
      <SegmentedControl
        size="sm"
        wrap
        aria-labelledby={`${name}-label`}
        value={value}
        onValueChange={(next) => {
          if (next) onChange(next);
        }}
      >
        {Object.entries(options).map(([key, text], index) => (
          <SegmentedControlItem key={key} id={index === 0 ? name : undefined} value={key}>
            {text}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
    </Field>
  );
}

export function PurposeField({
  value,
  onChange,
}: {
  value: AppointmentSnapshot["purpose"];
  onChange: (value: AppointmentSnapshot["purpose"]) => void;
}) {
  return (
    <Choices
      name="appointment-purpose"
      label="Finalidade"
      value={value}
      options={purposes}
      onChange={(next) => onChange(next as AppointmentSnapshot["purpose"])}
    />
  );
}

export function MeetingDateField({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
}) {
  return (
    <div className="w-40">
      <TextControl
        name="appointment-date"
        label="Data"
        placeholder="dd/mm/aaaa"
        inputMode="numeric"
        value={value}
        onChange={(next) => onChange(maskDateBR(next))}
        error={error}
      />
    </div>
  );
}

export function MeetingTimeFields({
  start,
  end,
  onStart,
  onEnd,
  errors,
}: {
  start: string;
  end: string;
  onStart: (value: string) => void;
  onEnd: (value: string) => void;
  errors: Record<string, string>;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="w-28">
        <TextControl
          name="appointment-start"
          label="Início"
          placeholder="14:00"
          inputMode="numeric"
          value={start}
          onChange={(next) => onStart(maskTime24(next))}
          error={errors["meeting.startTime"]}
        />
      </div>
      <div className="w-28">
        <TextControl
          name="appointment-end"
          label="Fim"
          placeholder="15:30"
          inputMode="numeric"
          value={end}
          onChange={(next) => onEnd(maskTime24(next))}
          error={errors["meeting.endTime"]}
        />
      </div>
    </div>
  );
}

export function AppointmentWorkFields({
  minutes,
  content,
  onMinutes,
  onContent,
  errors,
}: {
  minutes: string;
  content: string;
  onMinutes: (value: string) => void;
  onContent: (value: string) => void;
  errors: Record<string, string>;
}) {
  return (
    <>
      <div className="w-40">
        <TextControl
          name="performedMinutes"
          label="Minutos realizados"
          placeholder="90"
          inputMode="numeric"
          value={minutes}
          onChange={(next) => onMinutes(next.replace(/\D/g, ""))}
          error={errors.performedMinutes}
        />
      </div>
      <NarrativeField
        name="performedContent"
        label="Conteúdo realizado"
        placeholder="O que foi trabalhado e como o aluno participou"
        value={content}
        onChange={onContent}
        error={errors.performedContent}
      />
    </>
  );
}
