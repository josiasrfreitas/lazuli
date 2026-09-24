import type { ReactElement } from "react";

import { Field, FieldError, Input, Label } from "@lazuli/ui";

import { displaySetting, type SettingsErrors, type SettingsFields } from "./settings-model";

export type SettingsSectionProps = { fields: SettingsFields } & (
  | { readOnly: true }
  | {
      readOnly?: false;
      errors: SettingsErrors;
      disabled: boolean;
      onChange: (name: keyof SettingsFields, value: string) => void;
    }
);

type SettingsFieldProps = SettingsSectionProps & {
  name: keyof SettingsFields;
  label: string;
  unit: string;
  placeholder: string;
  autoFocus?: boolean;
};

export function SettingsField(props: SettingsFieldProps): ReactElement {
  const { name, label, unit, fields } = props;
  if (props.readOnly) {
    return (
      <dl className="grid gap-1.5">
        <dt className="text-caption text-muted-foreground">{label}</dt>
        <dd className="font-numeric flex min-h-7 items-center text-base tabular-nums">
          {displaySetting(name, fields[name])}
        </dd>
      </dl>
    );
  }
  return (
    <Field name={name} disabled={props.disabled}>
      <Label>
        {label} <span className="text-muted-foreground">({unit})</span>
      </Label>
      <Input
        aria-required="true"
        autoComplete="off"
        autoFocus={props.autoFocus}
        disabled={props.disabled}
        inputMode="decimal"
        invalid={props.errors[name] !== undefined}
        name={name}
        placeholder={`Ex.: ${props.placeholder}`}
        size="xs"
        type="text"
        value={fields[name]}
        onChange={(event) => props.onChange(name, event.target.value)}
      />
      {props.errors[name] !== undefined && <FieldError match>{props.errors[name]}</FieldError>}
    </Field>
  );
}
