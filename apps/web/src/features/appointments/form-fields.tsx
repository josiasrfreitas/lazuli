import type { JSX as ReactJSX } from "react";
import type { ReactNode } from "react";
import { CalendarDays, Clock3, FileText, Target } from "lucide-react";
import {
  Button,
  Field,
  FieldError,
  Input,
  Label,
  SegmentedControl,
  SegmentedControlItem,
} from "@lazuli/ui";
import type { AppointmentSnapshot } from "@lazuli/validators";
import { TextControl } from "~/features/classes/form-controls";
import { NarrativeField } from "~/features/shared/task-form";
import { TimeField } from "~/features/shared/time-field";
import { maskDateBR, parseDateBR } from "~/lib/masks";
import { formatDateOnlyBR } from "~/lib/format";
import { CalendarDatePicker } from "~/features/class-records/calendar-date-picker";
import { purposes, today } from "./shared";

function Choices({
  name,
  label,
  value,
  options,
  onChange,
}: {
  name: string;
  label: ReactNode;
  value: string;
  options: Record<string, string>;
  onChange: (value: string) => void;
}): ReactJSX.Element {
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
}): ReactJSX.Element {
  return (
    <Choices
      name="appointment-purpose"
      label={
        <span className="inline-flex items-center gap-2">
          <Target className="size-4" aria-hidden="true" />
          Finalidade
        </span>
      }
      value={value}
      options={purposes}
      onChange={(next) => onChange(next as AppointmentSnapshot["purpose"])}
    />
  );
}

export function MeetingDateField({
  minDate,
  compact = false,
  fluid = false,
  value,
  onChange,
  error,
}: {
  minDate?: string | undefined;
  value: string;
  compact?: boolean;
  fluid?: boolean;
  onChange: (value: string) => void;
  error?: string | undefined;
}): ReactJSX.Element {
  const widthClassName = compact ? "w-40" : "w-44";
  return (
    <div className={fluid ? "min-w-0 w-full" : widthClassName}>
      <Field>
        <Label htmlFor="appointment-date">Data</Label>
        <div className="relative">
          <Input
            id="appointment-date"
            name="appointment-date"
            size="sm"
            className="pr-9"
            placeholder="dd/mm/aaaa"
            inputMode="numeric"
            autoComplete="off"
            maxLength={10}
            value={value}
            onChange={(event) => onChange(maskDateBR(event.target.value))}
            invalid={Boolean(error)}
          />
          <MeetingDatePicker value={value} minDate={minDate} onChange={onChange} />
        </div>
        <FieldError match={Boolean(error)}>{error}</FieldError>
      </Field>
    </div>
  );
}

function MeetingDatePicker({
  value,
  minDate,
  onChange,
}: {
  value: string;
  minDate?: string | undefined;
  onChange: (value: string) => void;
}): ReactJSX.Element {
  return (
    <div className="absolute inset-y-0 right-0 flex items-center">
      <CalendarDatePicker
        date={parseDateBR(value) ?? today()}
        today={today()}
        minDate={minDate}
        onChange={(date) => onChange(formatDateOnlyBR(date))}
        trigger={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Abrir calendário da data do atendimento"
          >
            <CalendarDays aria-hidden="true" />
          </Button>
        }
      />
    </div>
  );
}

export function MeetingTimeFields({
  compact = false,
  start,
  end,
  onStart,
  onEnd,
  errors,
}: {
  compact?: boolean;
  start: string;
  end: string;
  onStart: (value: string) => void;
  onEnd: (value: string) => void;
  errors: Record<string, string>;
}): ReactJSX.Element {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className={compact ? "w-20" : "w-28"}>
        <TimeField
          name="appointment-start"
          label="Início"
          placeholder="hh:mm"
          value={start}
          onChange={onStart}
          error={errors["meeting.startTime"]}
        />
      </div>
      <div className={compact ? "w-20" : "w-28"}>
        <TimeField
          name="appointment-end"
          label="Fim"
          placeholder="hh:mm"
          value={end}
          onChange={onEnd}
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
}): ReactJSX.Element {
  return (
    <>
      <AppointmentDurationField
        value={minutes}
        onChange={onMinutes}
        error={errors.performedMinutes}
      />
      <AppointmentContentField
        value={content}
        onChange={onContent}
        error={errors.performedContent}
      />
    </>
  );
}

export function AppointmentDurationField({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
}): ReactJSX.Element {
  return (
    <div className="w-40">
      <TextControl
        name="performedMinutes"
        label="Minutos realizados"
        labelIcon={<Clock3 aria-hidden="true" className="size-3.5 text-muted-foreground" />}
        placeholder="90"
        inputMode="numeric"
        value={value}
        onChange={(next) => onChange(next.replaceAll(/\D/g, ""))}
        error={error}
      />
    </div>
  );
}

export function AppointmentContentField({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
}): ReactJSX.Element {
  return (
    <NarrativeField
      name="performedContent"
      label="Conteúdo realizado"
      labelIcon={<FileText aria-hidden="true" className="size-3.5 text-muted-foreground" />}
      placeholder="O que foi trabalhado e como o aluno participou"
      value={value}
      onChange={onChange}
      error={error}
    />
  );
}
