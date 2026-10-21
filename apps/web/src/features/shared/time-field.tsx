import type { ReactElement } from "react";
import { Field, FieldError, Input, Label } from "@lazuli/ui";
import { maskTime24 } from "~/lib/masks";

const TIME_DIGITS = 4;
const LAST_HOUR = 23;
const TIME_LENGTH = 5;
const PARTIAL_TIME_LENGTH = 3;

function maskTime(raw: string, deleting = false): string {
  if (raw.includes(":")) return colonTime(raw);
  const digits = raw.replaceAll(/\D/g, "").slice(0, TIME_DIGITS);
  if (!deleting && digits.length === 1 && Number(digits) > 2) {
    return `0${digits}:`;
  }
  if (!deleting && digits.length === 2) return `${digits}:`;
  if (digits.length === PARTIAL_TIME_LENGTH && Number(digits.slice(0, 2)) > LAST_HOUR) {
    return `0${digits[0]}:${digits.slice(1)}`;
  }
  return maskTime24(digits);
}

function completeTime(value: string): string {
  if (!value) return value;
  const [hour = "", minute = ""] = value.split(":");
  const completed = `${hour.padStart(2, "0")}:${minute.padEnd(2, "0")}`;
  // Keep invalid input visible so submit validation can explain it.
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(completed) ? completed : value;
}

export function TimeField({
  name,
  label,
  placeholder,
  value,
  onChange,
  error,
  align = "start",
}: {
  name: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  align?: "start" | "center";
}): ReactElement {
  return (
    <Field>
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type="text"
        size="sm"
        className={align === "center" ? "text-center tabular-nums" : undefined}
        inputMode="numeric"
        maxLength={TIME_LENGTH}
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        invalid={Boolean(error)}
        onChange={(event) => {
          const deleting =
            (event.nativeEvent as InputEvent).inputType?.startsWith("delete") ?? false;
          onChange(maskTime(event.target.value, deleting));
        }}
        onBlur={() => {
          const completed = completeTime(value);
          if (completed !== value) onChange(completed);
        }}
      />
      <FieldError match={Boolean(error)}>{error}</FieldError>
    </Field>
  );
}

function colonTime(raw: string): string {
  const [hour = "", minute = ""] = raw.split(":");
  const digits = hour.replaceAll(/\D/g, "").slice(0, 2);
  if (!digits) return "";
  return `${digits.padStart(2, "0")}:${minute.replaceAll(/\D/g, "").slice(0, 2)}`;
}
