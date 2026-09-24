"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
  type RefObject,
} from "react";

import type { FinanceSettingsInput } from "@lazuli/validators";
import { Button } from "@lazuli/ui";

import { SettingsSections } from "./settings-fields";
import {
  loadedFields,
  validateSettings,
  type SettingsErrors,
  type SettingsFields,
  type SettingsRow,
} from "./settings-model";

export type SettingsMutation = {
  isPending: boolean;
  mutateAsync: (values: FinanceSettingsInput) => Promise<SettingsRow | null>;
};

type SettingsFormProps = {
  row: SettingsRow | null;
  mutation: SettingsMutation;
  onCancel: () => void;
  onSaved: () => void;
};

type FormState = {
  fields: SettingsFields;
  errors: SettingsErrors;
  message: string;
  formRef: RefObject<HTMLFormElement | null>;
  onChange: (name: keyof SettingsFields, value: string) => void;
  submit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
};

function useSettingsForm({ row, mutation, onSaved }: SettingsFormProps): FormState {
  const [fields, setFields] = useState(() => loadedFields(row));
  const [errors, setErrors] = useState<SettingsErrors>({});
  const [message, setMessage] = useState("");
  const [validationAttempt, setValidationAttempt] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (validationAttempt > 0)
      formRef.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus();
  }, [validationAttempt]);
  const onChange = (name: keyof SettingsFields, value: string): void => {
    setFields((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setMessage("");
  };
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (mutation.isPending) return;
    setMessage("");
    const result = validateSettings(fields);
    if (!result.success) {
      setErrors(result.errors);
      setValidationAttempt((current) => current + 1);
      return;
    }
    setErrors({});
    try {
      const updated = await mutation.mutateAsync(result.values);
      if (updated === null) throw new Error("Settings were not returned after saving");
      onSaved();
    } catch {
      setMessage("Não foi possível salvar. Seus valores foram mantidos.");
    }
  }
  return { fields, errors, message, formRef, onChange, submit };
}

export function SettingsForm(input: SettingsFormProps): ReactElement {
  const { mutation, onCancel } = input;
  const form = useSettingsForm(input);
  return (
    <form
      ref={form.formRef}
      noValidate
      aria-label="Ajustes financeiros"
      onSubmit={(event) => void form.submit(event)}
    >
      <SettingsSections
        fields={form.fields}
        errors={form.errors}
        disabled={mutation.isPending}
        onChange={form.onChange}
      />
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-3">
        {form.message && (
          <p role="alert" className="w-full text-caption text-destructive">
            {form.message}
          </p>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-11 sm:min-h-0"
          disabled={mutation.isPending}
          onClick={onCancel}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          size="sm"
          className="min-h-11 sm:min-h-0"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
