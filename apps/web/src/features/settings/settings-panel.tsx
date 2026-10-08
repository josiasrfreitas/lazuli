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

function UpdateCredit({ row }: { row: SettingsRow | null }): ReactElement {
  if (row === null) return <p>Ainda não configurado.</p>;
  const date = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(row.updatedAt);
  return (
    <p>
      Atualizado em {date}
      <br />
      por {row.updatedByName ?? "autor desconhecido"}.
    </p>
  );
}

type SettingsPanelProps = {
  row: SettingsRow | null;
  mutation: SettingsMutation;
};

export function SettingsPanel({ row, mutation }: SettingsPanelProps): ReactElement {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const editRef = useRef<HTMLButtonElement>(null);
  const hasEdited = useRef(false);
  useEffect(() => {
    if (!editing && hasEdited.current) editRef.current?.focus();
  }, [editing]);
  return (
    <div className="rounded-md border border-border bg-card">
      {editing ? (
        <SettingsForm
          row={row}
          mutation={mutation}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            setSaved(true);
          }}
        />
      ) : (
        <>
          <SettingsSections fields={loadedFields(row)} readOnly />
          <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
            <div className="text-caption text-muted-foreground">
              {saved && <p role="status">Ajustes salvos.</p>}
              <UpdateCredit row={row} />
            </div>
            <Button
              ref={editRef}
              type="button"
              size="sm"
              variant="secondary"
              className="min-h-11 sm:min-h-0"
              onClick={() => {
                hasEdited.current = true;
                setSaved(false);
                setEditing(true);
              }}
            >
              {row === null ? "Configurar" : "Editar"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
